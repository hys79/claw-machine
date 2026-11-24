// 진입점: 타이틀 → 프롤로그(이름 입력 포함) → 가게(준비 중). 마우스/터치 공용.
// 캔버스는 창 전체를 채운다. 높이(576)는 고정, 너비(W)는 창 비율에 맞춰 늘어나며,
// UI는 가운데 960 영역(OX만큼 이동)에 그리고 배경 그림은 전체 폭을 덮는다.
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const wrap = document.getElementById('wrap');
  const input = document.getElementById('nameInput');
  const C = CFG.COLOR;
  const L = CFG.LAYOUT;
  const H = CFG.H;
  const DW = CFG.DESIGN_W;

  let W = DW;   // 현재 논리 너비
  let OX = 0;   // 가운데 UI 영역의 왼쪽 오프셋
  let scale = 1; // 논리 좌표 → 화면 픽셀

  let screen = 'title'; // title | intro | name | shop
  let modal = null;     // null | help | settings
  let introIdx = 0;
  let confirmWipe = false;
  let nameError = '';
  let now = 0;

  State.load();

  // ---------- 창 크기에 맞추기 ----------
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    W = Math.max(CFG.MIN_W, Math.min(CFG.MAX_W, Math.round(H * vw / vh)));
    OX = (W - DW) / 2;
    cv.width = W;
    cv.height = H;
    scale = Math.min(vw / W, vh / H);
    wrap.style.width = Math.round(W * scale) + 'px';
    wrap.style.height = Math.round(H * scale) + 'px';
    fitInput();
  }

  function fitInput() {
    input.style.left = Math.round((OX + 240) * scale) + 'px';
    input.style.top = Math.round(236 * scale) + 'px';
    input.style.width = Math.round(480 * scale) + 'px';
    input.style.height = Math.round(64 * scale) + 'px';
    input.style.fontSize = Math.round(32 * scale) + 'px';
  }

  // ---------- 그리기 도구 ----------
  function font(size) { return size + 'px ' + CFG.FONT + ', sans-serif'; }

  function text(s, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = font(size);
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function sprite(rows, x, y, s) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = DATA.PALETTE[row[i]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x + i * s, y + j * s, s, s);
      }
    });
  }

  // 도트풍 테두리 상자
  function box(b, fill, bw) {
    bw = bw || 4;
    ctx.fillStyle = C.ink;
    ctx.fillRect(b.x - bw, b.y - bw, b.w + bw * 2, b.h + bw * 2);
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // 푸른 계열 입체 버튼
  function button(b, label, fill, light, dark) {
    box(b, fill, 3);
    ctx.fillStyle = light;
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.fillStyle = dark;
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    if (label) text(label, b.x + b.w / 2, b.y + b.h / 2 - 1, Math.round(b.h * 0.42), C.white);
  }
  function mainButton(b, label) { button(b, label, C.blue, C.blueLight, C.blueDark); }
  function subButton(b, label) { button(b, label, C.sky, '#8cc3ee', '#3f86c2'); }

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  // 글자 테두리(배경 그림 위에서도 잘 읽히게)
  function outlineText(str, x, y, size, fill) {
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, Math.round(size / 4));
    ctx.strokeStyle = C.ink;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  // ---------- 입력 영역(가운데 960 영역 좌표) ----------
  const B = {
    ok: { x: 360, y: 400, w: 240, h: 56 },
    back: { x: 380, y: 472, w: 200, h: 48 },
    toTitle: { x: 360, y: 470, w: 240, h: 56 },
    close: { x: 360, y: 456, w: 240, h: 56 },
    wipe: { x: 300, y: 372, w: 360, h: 56 },
  };

  // 설정 버튼은 화면 오른쪽 위 모서리에 붙는다(전체 좌표)
  function settingsRect() {
    const s = CFG.SETTINGS_BTN;
    return { x: W - s.margin - s.size, y: s.margin, w: s.size, h: s.size };
  }

  function inside(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  function pointer(e) {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
  }

  // ---------- 화면 전환 ----------
  function go(next) {
    screen = next;
    modal = null;
    confirmWipe = false;
    nameError = '';
    input.style.display = next === 'name' ? 'block' : 'none';
    if (next === 'name') {
      input.value = '';
      fitInput();
      setTimeout(() => input.focus(), 0);
    }
  }

  function submitName() {
    const name = input.value.trim();
    if (!name) { nameError = '이름을 적어 줘!'; return; }
    State.data = State.fresh();
    State.data.playerName = name.slice(0, CFG.NAME_MAX);
    State.save();
    go('shop');
  }

  function onPress(e) {
    if (e.target === input) return;
    e.preventDefault();
    const abs = pointer(e);
    const p = { x: abs.x - OX, y: abs.y }; // 가운데 UI 영역 좌표

    if (modal) {
      if (modal === 'help' && inside(B.close, p)) modal = null;
      else if (modal === 'settings') {
        if (State.hasSave() && inside(B.wipe, p)) {
          if (confirmWipe) { State.wipe(); modal = null; confirmWipe = false; } else confirmWipe = true;
        } else if (inside(B.close, p)) { modal = null; confirmWipe = false; }
      }
      return;
    }

    if (screen === 'title') {
      if (inside(settingsRect(), abs)) modal = 'settings';
      else if (inside(L.helpBtn, p)) modal = 'help';
      else if (inside(L.startBtn, p)) {
        if (State.hasSave()) go('shop');
        else { introIdx = 0; go('intro'); }
      }
    } else if (screen === 'intro') {
      introIdx++;
      if (introIdx >= DATA.INTRO.length) go('name');
    } else if (screen === 'name') {
      if (inside(B.ok, p)) submitName();
      else if (inside(B.back, p)) go('title');
    } else if (screen === 'shop') {
      if (inside(B.toTitle, p)) go('title');
    }
  }
  cv.addEventListener('mousedown', onPress);
  cv.addEventListener('touchstart', onPress, { passive: false });
  input.addEventListener('input', () => { nameError = ''; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitName(); });
  window.addEventListener('resize', resize);

  // ---------- 화면별 그리기 ----------
  function drawGearButton() {
    const sb = settingsRect();
    button(sb, '', C.blue, C.blueLight, C.blueDark);
    const gs = 3, gw = DATA.GEAR[0].length * gs;
    sprite(DATA.GEAR, sb.x + (sb.w - gw) / 2, sb.y + (sb.h - gw) / 2 - 1, gs);
  }

  function drawTitle() {
    Scene.draw(ctx, now, W, H);
    ctx.save();
    ctx.translate(OX, 0);
    outlineText(DATA.TITLE_LINES[0], 480, 58, 40, C.white);
    outlineText(DATA.TITLE_LINES[1], 480, 112, 40, C.yellow);
    outlineText(DATA.SUBTITLE, 480, 160, 22, C.white);
    mainButton(L.startBtn, State.hasSave() ? '이어하기' : '시작하기');
    subButton(L.helpBtn, '게임 설명');
    ctx.restore();
    drawGearButton();
  }

  function drawIntro() {
    Scene.draw(ctx, now, W, H);
    ctx.save();
    ctx.translate(OX, 0);
    const d = { x: 40, y: 420, w: 880, h: 130 };
    box(d, C.white);
    text(DATA.INTRO[introIdx], d.x + 30, d.y + 52, 26, C.ink, 'left');
    text('▼ 화면을 눌러 계속', d.x + d.w - 24, d.y + d.h - 26, 18, C.gray, 'right');
    ctx.restore();
  }

  function drawName() {
    text(DATA.NAME_PROMPT, 480, 150, 34, C.ink);
    text('이름은 최대 ' + CFG.NAME_MAX + '글자예요', 480, 205, 22, C.gray);
    if (nameError) text(nameError, 480, 345, 24, C.alert);
    mainButton(B.ok, '확인');
    subButton(B.back, '뒤로');
  }

  function drawShop() {
    const d = State.data;
    text(d.playerName + ' 사장님의 인형뽑기 가게', 480, 70, 34, C.ink);
    box({ x: 240, y: 130, w: 480, h: 250 }, C.white);
    const rows = [['가게 랭크', DATA.RANK_NAMES[d.rank - 1] || ''], ['소지금', won(d.money)], ['영업 일차', d.day + '일차']];
    rows.forEach((r, i) => {
      text(r[0], 280, 185 + i * 70, 24, C.gray, 'left');
      text(r[1], 680, 185 + i * 70, 24, C.ink, 'right');
    });
    text('가게 화면은 다음 단계에서 만들어요', 480, 425, 22, C.gray);
    subButton(B.toTitle, '타이틀로');
  }

  function drawModal() {
    ctx.fillStyle = 'rgba(20,50,77,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(OX, 0);
    box({ x: 160, y: 90, w: 640, h: 440 }, C.white);
    if (modal === 'help') {
      text('게임 설명', 480, 142, 32, C.ink);
      DATA.HOWTO.forEach((s, i) => text(s, 200, 215 + i * 50, 22, C.ink, 'left'));
      mainButton(B.close, '닫기');
    } else {
      text('설정', 480, 142, 32, C.ink);
      if (State.hasSave()) {
        button(B.wipe, confirmWipe ? '정말 지울까요? 한 번 더' : '처음부터 다시', confirmWipe ? C.alert : C.sky,
          confirmWipe ? '#ef7a8f' : '#8cc3ee', confirmWipe ? '#a52c43' : '#3f86c2');
      } else {
        text('저장된 데이터가 없어요', 480, 400, 22, C.gray);
      }
      text(DATA.CREDIT_LINE, 480, 480, 18, C.gray);
      mainButton(B.close, '닫기');
    }
    ctx.restore();
  }

  function draw(ts) {
    now = (ts || 0) / 1000;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (screen === 'title') drawTitle();
    else if (screen === 'intro') drawIntro();
    else {
      ctx.save();
      ctx.translate(OX, 0);
      if (screen === 'name') drawName(); else drawShop();
      ctx.restore();
    }
    if (modal) drawModal();
    requestAnimationFrame(draw);
  }

  resize();

  // 폰트가 로드된 뒤 시작(실패해도 1.5초 후 시작)
  let started = false;
  function start() { if (started) return; started = true; requestAnimationFrame(draw); }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('20px ' + CFG.FONT, '가나다').then(start, start);
    setTimeout(start, 1500);
  } else {
    start();
  }
})();
