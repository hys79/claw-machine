// 진입점: 타이틀 화면 뼈대 (마우스/터치 공용)
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  let screen = 'title';

  State.load();

  const startBtn = { x: 330, y: 380, w: 300, h: 70 };

  function inside(b, p) {
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  }

  function pointer(e) {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * CFG.W / r.width, y: (t.clientY - r.top) * CFG.H / r.height };
  }

  function onPress(e) {
    e.preventDefault();
    const p = pointer(e);
    if (screen === 'title' && inside(startBtn, p)) screen = 'plan';
    else if (screen === 'plan') screen = 'title';
  }
  cv.addEventListener('mousedown', onPress);
  cv.addEventListener('touchstart', onPress, { passive: false });

  function text(s, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px sans-serif';
    ctx.textAlign = align || 'center';
    ctx.fillText(s, x, y);
  }

  function draw() {
    ctx.fillStyle = CFG.COLOR.bg;
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    if (screen === 'title') {
      text('박근령,', 480, 150, 48, CFG.COLOR.cream);
      text('증바람 프로게이머가 되다!', 480, 215, 48, CFG.COLOR.amber);
      text('5분만 더… 한 판만 더…', 480, 280, 22, CFG.COLOR.cream);
      ctx.fillStyle = CFG.COLOR.amber;
      ctx.fillRect(startBtn.x, startBtn.y, startBtn.w, startBtn.h);
      text('게임 시작', 480, 427, 30, CFG.COLOR.dark);
    } else {
      const d = State.data, s = d.stats;
      text('시즌 ' + d.season + ' · ' + d.week + '주차 (준비 중)', 480, 90, 30, CFG.COLOR.cream);
      const rows = [['손', s.hand], ['판단력', s.judge], ['팀파이트', s.fight], ['챔프 이해도', s.champ],
                    ['멘탈', s.mental], ['체력', s.stamina], ['귀찮음', s.lazy]];
      rows.forEach((r, i) => {
        text(r[0], 300, 170 + i * 42, 24, CFG.COLOR.cream, 'left');
        text(String(r[1]), 660, 170 + i * 42, 24, CFG.COLOR.amber, 'right');
      });
      text('화면을 누르면 타이틀로', 480, 520, 20, CFG.COLOR.cream);
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
