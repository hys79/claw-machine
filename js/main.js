// 진입점: 타이틀 → 프롤로그(이름 입력 포함) → 가게(준비 중). 마우스/터치 공용.
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const input = document.getElementById('nameInput');
  const C = CFG.COLOR;
  const L = CFG.LAYOUT;
  const S = DATA.SCENE;

  let screen = 'title'; // title | intro | name | shop
  let modal = null;     // null | help | settings
  let introIdx = 0;
  let confirmWipe = false;
  let nameError = '';

  State.load();

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
  function box(b, fill) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // 푸른 계열 입체 버튼
  function button(b, label, fill, light, dark) {
    box(b, fill);
    ctx.fillStyle = light;
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillStyle = dark;
    ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    if (label) text(label, b.x + b.w / 2, b.y + b.h / 2 - 2, 28, C.white);
  }
  function mainButton(b, label) { button(b, label, C.blue, C.blueLight, C.blueDark); }
  function subButton(b, label) { button(b, label, C.sky, '#8cc3ee', '#3f86c2'); }

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  // ---------- 도트 풍경(창동 아레나 느낌의 오리지널 그림) ----------
  function drawScene(b) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    const px = 6;
    // 하늘(띠 두 개)
    ctx.fillStyle = S.skyTop;
    ctx.fillRect(b.x, b.y, b.w, b.h * 0.45);
    ctx.fillStyle = S.skyBottom;
    ctx.fillRect(b.x, b.y + b.h * 0.45, b.w, b.h * 0.55);
    // 구름
    ctx.fillStyle = S.cloud;
    [[0.1, 0.12, 5], [0.72, 0.2, 6], [0.45, 0.08, 4]].forEach((c) => {
      const cx = b.x + b.w * c[0], cy = b.y + b.h * c[1], n = c[2];
      ctx.fillRect(cx, cy + px, n * px * 2, px);
      ctx.fillRect(cx + px, cy, (n - 1) * px * 2 - px, px);
    });
    // 돔 아레나(줄마다 폭을 계산해 도트로 쌓는다)
    const groundY = b.y + b.h * 0.78;
    const domeW = Math.round(b.w * 0.62 / px) * px;
    const rows = Math.round(b.h * 0.5 / px);
    const cx = b.x + b.w / 2;
    const halfAt = (r) => Math.round((domeW / 2) * Math.sqrt(1 - Math.pow((rows - 1 - r) / rows, 2)) / px) * px;
    // 외곽선(한 칸 크게) → 안쪽 채우기
    for (let r = 0; r < rows; r++) {
      const y = groundY - (rows - r) * px;
      ctx.fillStyle = S.domeLine;
      ctx.fillRect(cx - halfAt(r) - px, y, halfAt(r) * 2 + px * 2, px);
    }
    ctx.fillRect(cx - halfAt(0), groundY - rows * px - px, halfAt(0) * 2, px);
    for (let r = 0; r < rows; r++) {
      const y = groundY - (rows - r) * px;
      ctx.fillStyle = r % 4 === 3 ? S.domeDark : (r < rows / 2 ? S.dome : S.domeDark);
      ctx.fillRect(cx - halfAt(r), y, halfAt(r) * 2, px);
    }
    // 간판
    const sw = 14 * px, sh = 3 * px;
    ctx.fillStyle = S.domeLine;
    ctx.fillRect(cx - sw / 2 - 4, groundY - 5 * px - 4, sw + 8, sh + 8);
    ctx.fillStyle = S.sign;
    ctx.fillRect(cx - sw / 2, groundY - 5 * px, sw, sh);
    ctx.fillStyle = C.white;
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - sw / 2 + px + i * 2.4 * px, groundY - 5 * px + px, px, px);
    // 바닥
    ctx.fillStyle = S.ground;
    ctx.fillRect(b.x, groundY, b.w, b.y + b.h - groundY);
    ctx.fillStyle = S.groundLine;
    ctx.fillRect(b.x, groundY, b.w, 4);
    // 인형뽑기 기계 세 대
    const s = Math.max(3, Math.floor(b.h / 44));
    const mh = DATA.CLAW_MACHINE.length * s;
    const my = Math.min(groundY + 6 * s - mh + 8, b.y + b.h - mh);
    [0.1, 0.27, 0.73, 0.9].forEach((f) => sprite(DATA.CLAW_MACHINE, b.x + b.w * f - 8 * s, my, s));
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  }

  // ---------- 입력 영역 ----------
  const B = {
    ok: { x: 330, y: 400, w: 300, h: 72 },
    back: { x: 330, y: 488, w: 300, h: 56 },
    toTitle: { x: 330, y: 470, w: 300, h: 72 },
    close: { x: 330, y: 452, w: 300, h: 64 },
    wipe: { x: 280, y: 372, w: 400, h: 64 },
  };

  function inside(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  function pointer(e) {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * CFG.W / r.width, y: (t.clientY - r.top) * CFG.H / r.height };
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

  function fitInput() {
    input.style.fontSize = Math.round(32 * cv.clientWidth / CFG.W) + 'px';
  }
  window.addEventListener('resize', fitInput);

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
    const p = pointer(e);

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
      if (inside(L.settingsBtn, p)) modal = 'settings';
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

  // ---------- 화면별 그리기 ----------
  function drawTitle() {
    // 제목 배너
    const t = L.titleBox;
    box(t, C.banner);
    ctx.fillStyle = C.blueLight;
    ctx.fillRect(t.x, t.y, t.w, 6);
    text(DATA.TITLE_LINES[0], t.x + t.w / 2, t.y + 52, 32, C.white);
    text(DATA.TITLE_LINES[1], t.x + t.w / 2, t.y + 100, 32, C.yellow);
    // 풍경
    drawScene(L.sceneBox);
    // 버튼
    mainButton(L.startBtn, State.hasSave() ? '이어하기' : '시작하기');
    subButton(L.helpBtn, '게임 설명');
    // 설정 아이콘
    const sb = L.settingsBtn;
    box(sb, C.white);
    sprite(DATA.GEAR, sb.x + (sb.w - 11 * 5) / 2, sb.y + (sb.h - 11 * 5) / 2, 5);
  }

  function drawIntro() {
    drawScene({ x: 0, y: 0, w: CFG.W, h: 400 });
    const d = { x: 40, y: 420, w: 880, h: 130 };
    box(d, C.white);
    text(DATA.INTRO[introIdx], d.x + 30, d.y + 52, 26, C.ink, 'left');
    text('▼ 화면을 눌러 계속', d.x + d.w - 24, d.y + d.h - 26, 18, C.gray, 'right');
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
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    const m = { x: 160, y: 90, w: 640, h: 440 };
    box(m, C.white);
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
  }

  function draw() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    if (screen === 'title') drawTitle();
    else if (screen === 'intro') drawIntro();
    else if (screen === 'name') drawName();
    else drawShop();
    if (modal) drawModal();
    requestAnimationFrame(draw);
  }

  // 폰트가 로드된 뒤 시작(실패해도 1.5초 후 시작)
  let started = false;
  function start() { if (started) return; started = true; draw(); }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('20px ' + CFG.FONT, '가나다').then(start, start);
    setTimeout(start, 1500);
  } else {
    start();
  }
})();
