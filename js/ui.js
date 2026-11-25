// 공통 UI 부품(즉시 모드). 그리면서 클릭 영역도 같이 등록한다. 규칙은 docs/UI_GUIDE.md.
// 좌표는 논리 해상도(높이 576) 기준이고, ctx.translate로 옮긴 만큼은 자동으로 반영한다.
const UI = (function () {
  const C = CFG.COLOR;
  const BW = CFG.BW;
  let ctx = null;
  let canvas = null;
  let hits = [];      // 지난 프레임에 등록된 클릭 영역(나중에 그린 것이 위)
  let next = [];      // 이번 프레임에 등록 중인 클릭 영역
  let modalOpen = false;
  const mouse = { x: -1, y: -1, on: false };

  // 이 도트 폰트는 14px이 기준이라, 화면에 찍히는 글자 크기(기기 픽셀)를 14의 배수로 맞춰야 획이 또렷하다.
  // 요청한 크기에 가장 가까운 14의 배수로 바꾸고(논리 크기로 되돌려 돌려준다), 글자 시작 위치도 기기 픽셀에 맞춘다.
  function snapSize(size) {
    const k = ctx.getTransform().a;
    return Math.max(1, Math.round(size * k / 14)) * 14 / k;
  }
  function font(size) { return snapSize(size) + 'px ' + CFG.FONT + ', sans-serif'; }

  function begin(c, cv, modal) {
    ctx = c; canvas = cv; next = []; modalOpen = !!modal;
  }
  function end() {
    hits = next;
    if (canvas) canvas.style.cursor = mouse.on && hitAt(mouse) ? 'pointer' : 'default';
  }

  function setMouse(p) { mouse.x = p.x; mouse.y = p.y; mouse.on = !!p.on; }

  function hitAt(p) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
    }
    return null;
  }
  let dragging = null; // 누르고 끄는 중인 슬라이더
  const fracOf = (h, p) => Math.max(0, Math.min(1, (p.x - h.tx) / h.tw));
  // 누른 곳에 버튼이 있으면 실행하고 true. 비활성 버튼은 눌러도 반응 없음(true는 돌려줌: 아래 화면으로 안 새게).
  function click(p) {
    const h = hitAt(p);
    if (!h) return false;
    if (h.disabled) return true;
    if (h.drag) { dragging = h; h.drag(fracOf(h, p)); return true; }
    if (h.onClick) {
      if (h.sfx !== 'none' && typeof Sound !== 'undefined') Sound.sfx(h.sfx || 'click');
      h.onClick();
    }
    return true;
  }
  function move(p) { if (dragging) dragging.drag(fracOf(dragging, p)); return !!dragging; }
  function release() { if (dragging) { const d = dragging; dragging = null; if (d.end) d.end(); } }

  // ---------- 글자 ----------
  // outline을 주면 어두운 면·그림 위에서도 읽히는 테두리 글자. 밝은 면 위에서는 outline 없이 쓴다.
  function text(str, x, y, size, color, align, outline, outlineW) {
    ctx.font = font(size);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const tf = ctx.getTransform();
    const w = ctx.measureText(str).width;
    const m = ctx.measureText('가');                                   // 글자의 세로 가운데를 구한다
    const mid = ((m.actualBoundingBoxAscent || 0) - (m.actualBoundingBoxDescent || 0)) / 2;
    align = align || 'center';
    const lx = align === 'left' ? x : (align === 'right' ? x - w : x - w / 2);
    const sx = (Math.round(lx * tf.a + tf.e) - tf.e) / tf.a;           // 기기 픽셀에 맞춘 시작 위치
    const sy = (Math.round((y + mid) * tf.d + tf.f) - tf.f) / tf.d;
    if (outline) {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
      ctx.lineWidth = outlineW || Math.min(10, Math.max(4, Math.round(size / 4) * 1.5)); // 글자가 커져도 테두리는 일정하게(상한 10)
      ctx.strokeStyle = outline;
      ctx.strokeText(str, sx, sy);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, sx, sy);
  }

  // 정해진 상자(maxW×maxH 논리 크기)에 들어가는 가장 큰 또렷한 글자로 가운데에 그린다(긴 가게 이름 간판용).
  function fitText(str, cx, cy, maxW, maxH, color) {
    const k = ctx.getTransform().a;
    ctx.font = (14 / k) + 'px ' + CFG.FONT + ', sans-serif';
    const w14 = Math.max(1, ctx.measureText(str).width * k);            // 14px 기준 기기 픽셀 폭
    const n = Math.max(1, Math.floor(Math.min(maxW * k / w14, maxH * k / 14)));
    text(str, cx, cy, n * 14 / k, color, 'center');
  }

  // 폭에 맞춰 줄바꿈(띄어쓰기 우선, 단어가 길면 글자 단위)
  function wrap(str, maxW, size) {
    ctx.font = font(size);
    const lines = [];
    let cur = '';
    str.split(' ').forEach((word) => {
      const tryLine = cur ? cur + ' ' + word : word;
      if (ctx.measureText(tryLine).width <= maxW) { cur = tryLine; return; }
      if (cur) lines.push(cur);
      cur = '';
      for (const ch of word) {
        if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- 면 ----------
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

  // 테두리는 바깥쪽으로 그린다(b는 안쪽 영역).
  function framed(b, fill, bw, border) {
    rect(b.x - bw, b.y - bw, b.w + bw * 2, b.h + bw * 2, border || C.ink);
    rect(b.x, b.y, b.w, b.h, fill);
  }

  // 창: 딱딱한 오프셋 그림자 + 굵은 테두리(가장 바깥 창만 굵게)
  function panel(b, fill, bw) {
    bw = bw || BW.panel;
    const off = Math.min(bw, 5);
    rect(b.x - bw + off, b.y - bw + off, b.w + bw * 2, b.h + bw * 2, C.shadow);
    framed(b, fill || C.white, bw);
  }

  // 작은 정보 상자(HUD 알약 등): 흰 면 + 얇은 테두리 + 오프셋 그림자. 상자는 항상 흰색 테마.
  function chip(b) {
    const bw = BW.small;
    rect(b.x - bw + 2, b.y - bw + 3, b.w + bw * 2, b.h + bw * 2, C.shadow);
    framed(b, C.white, bw);
  }

  function scrim(w, h) { rect(0, 0, w, h, C.scrim); }

  function hline(x, y, w, color) { rect(x, y, w, 2, color || C.line); }

  // ---------- 버튼 ----------
  const STYLE = {
    primary: { fill: C.blue, hi: C.blueHi, text: C.white, border: C.ink, top: C.blueLight, shade: C.blueDark },
    secondary: { fill: C.white, hi: '#eaf4fd', text: C.ink, border: C.ink, top: C.white, shade: C.line },
    soft: { fill: C.soft, hi: '#eef5fb', text: C.sub, border: C.edge, top: C.white, shade: C.line },
    danger: { fill: C.alert, hi: C.alertHi, text: C.white, border: C.ink, top: C.alertLight, shade: C.alertDark },
  };

  // b: 안쪽 영역. o: {style, size, onClick, sfx(효과음 이름, 'none'이면 무음), modal, disabled, bare(상자 없이 draw만), draw(x,y,w,h,hover)}
  function button(b, label, o) {
    o = o || {};
    const st = STYLE[o.disabled ? 'soft' : (o.style || 'primary')];
    const bw = BW.button;
    const tf = ctx.getTransform();
    const abs = { x: b.x - bw + tf.e / tf.a, y: b.y - bw + tf.f / tf.d, w: b.w + bw * 2, h: b.h + bw * 2 };
    const live = !modalOpen || o.modal;
    if (live) next.push(Object.assign(abs, { onClick: o.onClick, disabled: o.disabled, sfx: o.sfx }));
    const hover = live && !o.disabled && mouse.on &&
      mouse.x >= abs.x && mouse.x <= abs.x + abs.w && mouse.y >= abs.y && mouse.y <= abs.y + abs.h;
    const y = b.y - (hover ? 1 : 0);

    if (o.bare) { o.draw(b.x, y, b.w, b.h, hover); return; } // 상자 없이 아이콘만

    rect(b.x - bw + 2, y - bw + 3, b.w + bw * 2, b.h + bw * 2, C.shadow);          // 그림자
    framed({ x: b.x, y, w: b.w, h: b.h }, hover ? st.hi : st.fill, bw, st.border);  // 테두리 + 면
    rect(b.x, y, b.w, 3, st.top);                                                   // 윗줄 하이라이트
    rect(b.x, y + b.h - 4, b.w, 4, st.shade);                                       // 아랫줄 그늘
    if (o.draw) o.draw(b.x, y, b.w, b.h, hover);
    else if (label) text(label, b.x + b.w / 2, y + b.h / 2 - 1, o.size || Math.min(26, Math.round(b.h * 0.42)), st.text);
  }

  // 팝업 밑의 버튼이 눌리지 않게 막는 영역(팝업 내용을 그리기 전에 부른다)
  function block(b) {
    if (modalOpen) return;
    const tf = ctx.getTransform();
    next.push({ x: b.x + tf.e / tf.a, y: b.y + tf.f / tf.d, w: b.w, h: b.h, disabled: true });
  }

  // ---------- 조립 부품 ----------
  // 화면 제목: 큰 글자 + 파란 밑줄 + 작은 부제
  function title(str, cx, y, sub) {
    text(str, cx, y, 36, C.ink);
    rect(cx - 18, y + 28, 36, 4, C.blue);
    if (sub) text(sub, cx, y + 52, 15, C.sub);
  }

  // 도트 그림은 작은 이미지로 한 번 만든 뒤 확대해서 그린다(칸마다 칠하면 소수 배율에서 틈이 보인다).
  const imgCache = new WeakMap();
  function pixImg(rows, pal) {
    const key = typeof pal === 'string' ? pal : 'pal';
    let m = imgCache.get(rows);
    if (!m) { m = new Map(); imgCache.set(rows, m); }
    let img = m.get(key);
    if (img) return img;
    img = document.createElement('canvas');
    img.width = rows[0].length; img.height = rows.length;
    const g = img.getContext('2d');
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.') continue;
        const c = typeof pal === 'string' ? pal : pal[row[i]];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(i, j, 1, 1);
      }
    });
    m.set(key, img);
    return img;
  }
  // pal: 글자->색 표, 또는 한 가지 색(문자열). 크기는 s배.
  function sprite(rows, pal, x, y, s) {
    const img = pixImg(rows, pal);
    ctx.drawImage(img, x, y, img.width * s, img.height * s);
  }

  // 8각 코인(8x8 도트)
  const COIN = ['..kkkk..', '.kyyyyk.', 'kyhyyyyk', 'kyhyyyyk', 'kyyyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'];
  const COIN_PAL = { k: '#b8801f', y: '#f2c14e', h: '#fff1b8' };
  function coin(x, y, s) { sprite(COIN, COIN_PAL, x, y, s); }

  // 소지금 알약(왼쪽 위 공통): 흰 상자
  function moneyPill(b, amount) {
    chip(b);
    coin(b.x + 9, b.y + (b.h - 16) / 2, 2);
    text(amount, b.x + b.w - 10, b.y + b.h / 2, 16, C.ink, 'right');
  }

  // 슬라이더: 트랙(파란 채움) + 흰 손잡이. value 0~1. o: {onChange, onEnd, modal, disabled, dim(음소거처럼 흐리게)}
  function slider(b, value, o) {
    o = o || {};
    const tf = ctx.getTransform();
    const live = !modalOpen || o.modal;
    const kw = 16, tx = b.x + kw / 2, tw = b.w - kw; // 손잡이가 트랙 끝에서도 안 잘리게
    if (live) next.push({ x: b.x + tf.e / tf.a, y: b.y + tf.f / tf.d, w: b.w, h: b.h, tx: tx + tf.e / tf.a, tw, drag: o.onChange, end: o.onEnd, disabled: o.disabled });
    const cy = b.y + b.h / 2, th = 10;
    framed({ x: b.x, y: cy - th / 2, w: b.w, h: th }, C.soft, 2);
    const fx = Math.round(tx + tw * value);
    if (fx > b.x) rect(b.x, cy - th / 2, fx - b.x, th, (o.dim || o.disabled) ? C.edge : C.blue);
    const k = { x: fx - kw / 2, y: cy - 13, w: kw, h: 26 };
    rect(k.x - 2 + 2, k.y - 2 + 3, k.w + 4, k.h + 4, C.shadow);
    framed(k, C.white, 2);
    rect(k.x, k.y + k.h - 4, k.w, 4, C.line);
    rect(k.x + 6, k.y + 7, 2, 12, (o.dim || o.disabled) ? C.edge : C.blue);
  }

  // 대사창: 흰 창 + 위에 걸친 이름표 + 끝에 깜빡이는 ▼
  function dialog(b, tag, lines, ready, t, tagColor) {
    panel(b, C.white, BW.dialog);
    if (tag) {
      ctx.font = font(18);
      const tw = Math.ceil(ctx.measureText(tag).width) + 28;
      framed({ x: b.x + 20, y: b.y - 20, w: tw, h: 32 }, tagColor || C.blue, BW.button);
      text(tag, b.x + 20 + tw / 2, b.y - 4, 18, C.white);
    }
    lines.forEach((s, i) => text(s, b.x + 30, b.y + 42 + i * 38, 26, C.ink, 'left'));
    if (ready && Math.floor(t * 2) % 2 === 0) text('▼', b.x + b.w - 30, b.y + b.h - 28, 22, C.blue, 'right');
  }

  return { begin, end, setMouse, click, move, release, text, wrap, rect, framed, panel, chip, scrim, hline, button, slider, title, sprite, coin, moneyPill, dialog, font, fitText, block };
})();
