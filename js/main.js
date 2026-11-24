// 진입점: 타이틀 → 이름 입력 → 가게(준비 중). 마우스/터치 공용.
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const input = document.getElementById('nameInput');
  const C = CFG.COLOR;
  let screen = 'title';
  let confirmWipe = false;
  let nameError = '';

  State.load();

  // ---------- 그리기 도구 ----------
  function text(s, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = size + 'px ' + CFG.FONT + ', sans-serif';
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

  // 테두리 있는 도트풍 버튼
  function button(b, label, fill) {
    ctx.fillStyle = C.dark;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    text(label, b.x + b.w / 2, b.y + b.h / 2, 28, C.dark);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = C.dark;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = C.panel;
    ctx.fillRect(x, y, w, h);
  }

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  // ---------- 버튼 영역 ----------
  const B = {
    start: { x: 330, y: 400, w: 300, h: 64 },
    cont: { x: 330, y: 400, w: 300, h: 64 },
    fresh: { x: 330, y: 484, w: 300, h: 56 },
    ok: { x: 330, y: 400, w: 300, h: 64 },
    back: { x: 330, y: 484, w: 300, h: 56 },
    toTitle: { x: 330, y: 470, w: 300, h: 64 },
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
    if (!name) { nameError = '이름을 입력해 줘!'; return; }
    State.data = State.fresh();
    State.data.playerName = name.slice(0, CFG.NAME_MAX);
    State.save();
    go('shop');
  }

  function onPress(e) {
    if (e.target === input) return;
    e.preventDefault();
    const p = pointer(e);
    if (screen === 'title') {
      if (State.hasSave()) {
        if (inside(B.cont, p)) go('shop');
        else if (inside(B.fresh, p)) {
          if (confirmWipe) { State.wipe(); go('name'); } else confirmWipe = true;
        }
      } else if (inside(B.start, p)) go('name');
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
    sprite(DATA.CLAW_MACHINE, 416, 30, 7);
    text(DATA.TITLE_LINES[0], 480, 222, 36, C.cream);
    text(DATA.TITLE_LINES[1], 480, 270, 36, C.yellow);
    text(DATA.SUBTITLE, 480, 330, 22, C.gray);
    if (State.hasSave()) {
      button(B.cont, '이어하기', C.yellow);
      button(B.fresh, confirmWipe ? '정말 지울까요? 한 번 더' : '처음부터 다시', confirmWipe ? C.pink : C.gray);
    } else {
      button(B.start, '게임 시작', C.yellow);
    }
  }

  function drawName() {
    text('사장님 이름을 알려 주세요', 480, 150, 34, C.cream);
    text('이름은 최대 ' + CFG.NAME_MAX + '글자예요', 480, 200, 22, C.gray);
    ctx.fillStyle = C.pink;
    ctx.fillRect(432, 250, 96, 4);
    if (nameError) text(nameError, 480, 345, 24, C.pink);
    button(B.ok, '확인', C.yellow);
    button(B.back, '뒤로', C.gray);
  }

  function drawShop() {
    const d = State.data;
    text(d.playerName + ' 사장님의 인형뽑기 가게', 480, 70, 34, C.yellow);
    panel(240, 130, 480, 250);
    text('가게 랭크', 290, 185, 24, C.gray, 'left');
    text(DATA.RANK_NAMES[d.rank - 1] || '', 670, 185, 24, C.cream, 'right');
    text('소지금', 290, 255, 24, C.gray, 'left');
    text(won(d.money), 670, 255, 24, C.cream, 'right');
    text('영업 일차', 290, 325, 24, C.gray, 'left');
    text(d.day + '일차', 670, 325, 24, C.cream, 'right');
    text('가게 화면은 다음 단계에서 만들어요', 480, 425, 22, C.gray);
    button(B.toTitle, '타이틀로', C.gray);
  }

  function draw() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    if (screen === 'title') drawTitle();
    else if (screen === 'name') drawName();
    else drawShop();
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
