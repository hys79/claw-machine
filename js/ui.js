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

  function font(size) { return size + 'px ' + CFG.FONT + ', sans-serif'; }

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
  // 누른 곳에 버튼이 있으면 실행하고 true. 비활성 버튼은 눌러도 반응 없음(true는 돌려줌: 아래 화면으로 안 새게).
  function click(p) {
    const h = hitAt(p);
    if (!h) return false;
    if (!h.disabled && h.onClick) h.onClick();
    return true;
  }

  // ---------- 글자 ----------
  // outline을 주면 어두운 면·그림 위에서도 읽히는 테두리 글자. 밝은 면 위에서는 outline 없이 쓴다.
  function text(str, x, y, size, color, align, outline) {
    ctx.font = font(size);
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (outline) {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(4, Math.round(size / 4) * 1.5);
      ctx.strokeStyle = outline;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
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

  // HUD용 반투명 어두운 상자
  function glass(b) {
    rect(b.x, b.y, b.w, b.h, C.glass);
    ctx.strokeStyle = C.glassLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
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

  // b: 안쪽 영역. o: {style, size, onClick, modal, disabled, draw(x,y,w,h)}
  function button(b, label, o) {
    o = o || {};
    const st = STYLE[o.disabled ? 'soft' : (o.style || 'primary')];
    const bw = BW.button;
    const tf = ctx.getTransform();
    const abs = { x: b.x - bw + tf.e / tf.a, y: b.y - bw + tf.f / tf.d, w: b.w + bw * 2, h: b.h + bw * 2 };
    const live = !modalOpen || o.modal;
    if (live) next.push(Object.assign(abs, { onClick: o.onClick, disabled: o.disabled }));
    const hover = live && !o.disabled && mouse.on &&
      mouse.x >= abs.x && mouse.x <= abs.x + abs.w && mouse.y >= abs.y && mouse.y <= abs.y + abs.h;
    const y = b.y - (hover ? 1 : 0);

    rect(b.x - bw + 2, y - bw + 3, b.w + bw * 2, b.h + bw * 2, C.shadow);          // 그림자
    framed({ x: b.x, y, w: b.w, h: b.h }, hover ? st.hi : st.fill, bw, st.border);  // 테두리 + 면
    rect(b.x, y, b.w, 3, st.top);                                                   // 윗줄 하이라이트
    rect(b.x, y + b.h - 4, b.w, 4, st.shade);                                       // 아랫줄 그늘
    if (o.draw) o.draw(b.x, y, b.w, b.h, hover);
    else if (label) text(label, b.x + b.w / 2, y + b.h / 2 - 1, o.size || Math.min(26, Math.round(b.h * 0.42)), st.text);
  }

  // ---------- 조립 부품 ----------
  // 화면 제목: 큰 글자 + 파란 밑줄 + 작은 부제
  function title(str, cx, y, sub) {
    text(str, cx, y, 36, C.ink);
    rect(cx - 18, y + 28, 36, 4, C.blue);
    if (sub) text(sub, cx, y + 52, 15, C.sub);
  }

  // 8각 코인(8x8 도트)
  const COIN = ['..kkkk..', '.kyyyyk.', 'kyhyyyyk', 'kyhyyyyk', 'kyyyyyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'];
  const COIN_PAL = { k: '#b8801f', y: '#f2c14e', h: '#fff1b8' };
  function coin(x, y, s) {
    COIN.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = COIN_PAL[row[i]];
        if (c) rect(x + i * s, y + j * s, s, s, c);
      }
    });
  }

  // 소지금 알약(왼쪽 위 공통)
  function moneyPill(b, amount) {
    glass(b);
    coin(b.x + 10, b.y + (b.h - 24) / 2, 3);
    text(amount, b.x + b.w - 12, b.y + b.h / 2, 18, C.white, 'right');
  }

  // 대사창: 흰 창 + 위에 걸친 이름표 + 끝에 깜빡이는 ▼
  function dialog(b, tag, lines, ready, t) {
    panel(b, C.white, BW.dialog);
    if (tag) {
      const tw = tag.length * 18 + 28;
      framed({ x: b.x + 20, y: b.y - 20, w: tw, h: 32 }, C.blue, BW.button);
      text(tag, b.x + 20 + tw / 2, b.y - 4, 18, C.white);
    }
    lines.forEach((s, i) => text(s, b.x + 30, b.y + 52 + i * 38, 26, C.ink, 'left'));
    if (ready && Math.floor(t * 2) % 2 === 0) text('▼', b.x + b.w - 30, b.y + b.h - 28, 22, C.blue, 'right');
  }

  return { begin, end, setMouse, click, text, wrap, rect, framed, panel, glass, scrim, hline, button, title, coin, moneyPill, dialog, font };
})();
