// 컷신: DATA.STORY 대본을 한 단계씩 실행해 도트 장면 + 대사창을 보여 준다.
// 입력: 클릭 / Space / Enter = 다음(글자가 나오는 중이면 먼저 전부 표시), 건너뛰기는 main.js에서 처리.
// 그림은 Scene과 같은 도트 좌표계(0~240 가운데 영역, 양옆 60 여분)를 쓰고, 화면에는 정수에 가깝게 확대해서 덮는다.
const Cutscene = (function () {
  const C = CFG.COLOR;
  const GW = 240, GH = 144, EXT = 60, LW = GW + EXT * 2;
  const FADE = 0.6;      // 장면 시작·끝 페이드(초)
  const TITLE_TIME = 3;  // 타이틀 카드 표시 시간(초)
  let st = null;
  let arcadeImg = null;
  let px = null; // 장면 위에 매 프레임 그리는 도트 층(인물·소품)
  let pg = null;

  function rngMaker(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // ---------- 도트 그림 ----------
  const PLUSH = ['#ff9fc2', '#ffd84a', '#ffffff', '#8fd3ff', '#c9a6ff', '#ffb27a'];

  // 인형(곰돌이 느낌의 작은 도트)
  function plush(g, x, y, c) {
    rect(g, x, y + 1, 5, 4, c);
    rect(g, x, y, 1, 1, c); rect(g, x + 4, y, 1, 1, c);
    rect(g, x + 1, y + 2, 1, 1, '#14324d'); rect(g, x + 3, y + 2, 1, 1, '#14324d');
  }

  // 인형뽑기 기계(32x56). claw=true면 가운데 집게도 그린다.
  function clawMachine(g, x, y, cab, accent, seed, claw) {
    const r = rngMaker(seed);
    rect(g, x, y, 32, 56, '#14324d');
    rect(g, x + 1, y + 1, 30, 54, cab);
    rect(g, x + 2, y + 2, 28, 7, accent);
    for (let i = 0; i < 7; i++) rect(g, x + 4 + i * 4, y + 5, 2, 2, i % 2 ? '#ffd84a' : '#ffffff');
    rect(g, x + 3, y + 11, 26, 28, '#14324d');
    rect(g, x + 4, y + 12, 24, 26, '#dff1ff');
    for (let i = 0; i < 6; i++) rect(g, x + 5 + i * 2, y + 12 + i * 2, 1, 1, '#ffffff'); // 유리 반사
    for (let k = 0; k < 14; k++) plush(g, x + 5 + Math.floor(r() * 18), y + 27 + Math.floor(r() * 8), PLUSH[Math.floor(r() * PLUSH.length)]);
    rect(g, x + 4, y + 13, 24, 2, '#8fa9be');
    if (claw) { rect(g, x + 15, y + 15, 1, 8, '#44505c'); rect(g, x + 13, y + 23, 5, 1, '#44505c'); rect(g, x + 13, y + 24, 1, 2, '#44505c'); rect(g, x + 17, y + 24, 1, 2, '#44505c'); }
    rect(g, x + 2, y + 40, 28, 6, '#14324d');
    rect(g, x + 3, y + 41, 26, 4, cab === '#ffffff' ? '#c9d9e6' : '#1f5f9f');
    rect(g, x + 8, y + 40, 1, 3, '#cfd8e0'); rect(g, x + 7, y + 38, 3, 3, '#ff5a5a'); // 조이스틱
    rect(g, x + 15, y + 42, 3, 2, '#ffd84a'); rect(g, x + 20, y + 42, 3, 2, '#6ab0f0'); // 버튼
    rect(g, x + 25, y + 41, 3, 3, '#0b1e30');                                          // 동전 구멍
    rect(g, x + 5, y + 47, 22, 7, '#14324d'); rect(g, x + 6, y + 48, 20, 5, '#2a3f55'); // 배출구
    rect(g, x + 2, y + 55, 5, 2, '#14324d'); rect(g, x + 25, y + 55, 5, 2, '#14324d');
  }

  const HERO_X = 117; // 주인공이 하는 기계(도트 좌표 0~240 기준, 왼쪽 위)
  const HERO_Y = 38;

  function buildArcade() {
    const img = document.createElement('canvas');
    img.width = LW; img.height = GH;
    const g = img.getContext('2d');
    // 벽
    for (let y = 0; y < 82; y++) {
      const t = y / 82;
      rect(g, 0, y, LW, 1, t < 0.5 ? '#d6e6f5' : '#c3daef');
    }
    for (let x = 0; x < LW; x += 24) rect(g, x, 0, 1, 82, '#b4cde6');
    rect(g, 0, 0, LW, 4, '#14324d');                                  // 천장 띠
    for (let x = 6; x < LW; x += 20) { rect(g, x, 4, 8, 2, '#fff7c2'); rect(g, x + 1, 6, 6, 1, 'rgba(255,247,194,0.5)'); }
    // 네온 간판(별 + 집게)
    rect(g, 118, 12, 124, 18, '#14324d');
    rect(g, 120, 14, 120, 14, '#0f2740');
    rect(g, 121, 15, 118, 1, '#6ab0f0'); rect(g, 121, 26, 118, 1, '#6ab0f0');
    rect(g, 121, 15, 1, 12, '#6ab0f0'); rect(g, 238, 15, 1, 12, '#6ab0f0');
    [[130, 21], [150, 21], [210, 21], [230, 21]].forEach((s) => { rect(g, s[0], s[1] - 2, 1, 5, '#ffd84a'); rect(g, s[0] - 2, s[1], 5, 1, '#ffd84a'); });
    rect(g, 179, 17, 2, 4, '#6ab0f0'); rect(g, 175, 21, 10, 1, '#6ab0f0'); rect(g, 175, 22, 1, 3, '#6ab0f0'); rect(g, 184, 22, 1, 3, '#6ab0f0'); rect(g, 179, 22, 2, 3, '#ffffff');
    // 걸레받이
    rect(g, 0, 80, LW, 4, '#8fa9be');
    // 바닥(체크 타일)
    for (let y = 84; y < GH; y += 10) for (let x = 0; x < LW; x += 20) {
      const a = ((x / 20 + (y - 84) / 10) | 0) % 2;
      rect(g, x, y, 20, 10, a ? '#e6f0fa' : '#c7dcf0');
    }
    // 기계들
    const cabs = ['#2f80d0', '#ffffff', '#6ab0f0', '#2f80d0', '#ffffff', '#1f5f9f'];
    const accs = ['#ffd84a', '#2f80d0', '#ffffff', '#ffd84a', '#6ab0f0', '#ffd84a'];
    for (let i = 0; i < 6; i++) {
      const x = EXT + 6 + i * 37;
      if (x - EXT === HERO_X) { clawMachine(g, x, HERO_Y + 2, cabs[i], accs[i], 77, false); continue; }
      clawMachine(g, x, 40, cabs[i], accs[i], 11 + i * 7, true);
    }
    // 바닥 그림자
    for (let i = 0; i < 6; i++) rect(g, EXT + 6 + i * 37 + 2, 97, 30, 2, 'rgba(20,50,77,0.18)');
    arcadeImg = img;
  }

  // 주인공(12x20, 파란 후드티). 정면 도트.
  const ME = [
    '...hhhhhh...', '..hhhhhhhh..', '..hhssssss..', '..hsskssks..', '..hssssssh..', '...ssmmss...',
    '....ssss....', '..bbbbbbbb..', '.bbbbbbbbbb.', '.sbbbbbbbbs.', '.sbbwwwwbbs.', '.sbbbbbbbbs.',
    '..bbbbbbbb..', '..pppppppp..', '..pppp.ppp..', '..ppp..ppp..', '..ppp..ppp..', '..ppp..ppp..',
    '..ddd..ddd..', '.dddd..dddd.',
  ];
  const ME_PAL = { h: '#3b2a20', s: '#f0c9a0', k: '#14324d', m: '#c46a5a', b: '#2f80d0', w: '#ffffff', p: '#2d4a66', d: '#14324d' };

  function drawRows(g, rows, pal, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) rect(g, x + i, y + j, 1, 1, c);
      }
    });
  }

  // 구경꾼(몸 5px, 키 9~11px). 피부·머리색·옷색이 다양하다.
  const SKIN = ['#f0c9a0', '#d9a066', '#a8683a', '#ffdbb8', '#7a4a2a'];
  const HAIR = ['#2b1b10', '#f2d16b', '#a3522a', '#1c1c1c', '#d9d9d9', '#7a3b1e'];
  const CLOTH = ['#e0556f', '#4a7fd8', '#f2b84b', '#6bc16a', '#a56bd8', '#ffffff', '#2d4a66', '#ff8a4a', '#40b8b0'];
  function makeCrowd(n) {
    const r = rngMaker(4242);
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({
        x0: r() * 240, y: 98 + Math.floor(r() * 9), speed: (r() < 0.5 ? -1 : 1) * (4 + r() * 6),
        skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)],
        cloth: CLOTH[Math.floor(r() * CLOTH.length)], pants: r() < 0.5 ? '#2d4a66' : '#5a4a3a',
        h: 9 + Math.floor(r() * 3), flag: r() < 0.3 ? CLOTH[Math.floor(r() * CLOTH.length)] : null,
      });
    }
    list.sort((a, b) => a.y - b.y);
    return list;
  }
  function drawPerson(g, p, t) {
    const x = Math.round(((p.x0 + p.speed * t) % 280 + 280) % 280 - 20);
    const y = p.y - p.h;
    const step = Math.floor(t * 4 + p.x0) % 2;
    rect(g, x + 1, y, 3, 3, p.skin);
    rect(g, x + 1, y, 3, 1, p.hair);
    rect(g, x, y + 3, 5, 4, p.cloth);
    rect(g, x + 1, y + 7, 1, p.h - 7, p.pants); rect(g, x + 3, y + 7, 1, p.h - 7 - step, p.pants);
    if (p.flag) { rect(g, x + 5, y - 3, 1, 8, '#44505c'); rect(g, x + 6, y - 3, 4, 3, p.flag); }
  }

  // 말풍선 위 아이콘
  const ICON = {
    '!': { rows: ['.yy.', '.yy.', '.yy.', '.yy.', '.yy.', '....', '.yy.', '.yy.'], pal: { y: '#ffd84a' } },
    bulb: { rows: ['..yyy..', '.yyyyy.', 'yywyyyy', 'yywyyyy', 'yyyyyyy', '.yyyyy.', '..ggg..', '..ggg..', '...g...'], pal: { y: '#ffd84a', w: '#ffffff', g: '#8795a5' } },
  };
  function drawIcon(g, key, cx, cy) {
    const ic = ICON[key]; if (!ic) return;
    const w = ic.rows[0].length, h = ic.rows.length;
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].forEach((d) => {
      ic.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') rect(g, cx - w / 2 + i + d[0], cy + j + d[1], 1, 1, '#14324d'); });
    });
    drawRows(g, ic.rows, ic.pal, Math.round(cx - w / 2), cy);
  }

  // 작은 인형뽑기 가게(컷신 마지막 장면의 소품)
  function drawShop(g) {
    const x = 6, y = 66, w = 62, h = 40;
    rect(g, x - 1, y - 1, w + 2, h + 2, '#14324d');
    rect(g, x, y, w, h, '#f5f9fc');
    rect(g, x, y, w, 4, '#2f80d0');
    // 간판
    rect(g, x + 6, y + 6, w - 12, 10, '#14324d'); rect(g, x + 7, y + 7, w - 14, 8, '#2f80d0');
    for (let i = 0; i < 6; i++) rect(g, x + 12 + i * 8, y + 9, 5, 4, i % 2 ? '#ffffff' : '#ffd84a');
    // 차양(파랑·흰 줄무늬)
    for (let i = 0; i < w; i += 6) { rect(g, x + i, y + 18, 3, 6, '#2f80d0'); rect(g, x + i + 3, y + 18, 3, 6, '#ffffff'); }
    rect(g, x, y + 24, w, 1, '#14324d');
    // 쇼윈도(기계 2대) + 문
    rect(g, x + 4, y + 26, 34, 14, '#14324d'); rect(g, x + 5, y + 27, 32, 13, '#cfeaff');
    clawMini(g, x + 7, y + 28, '#2f80d0'); clawMini(g, x + 22, y + 28, '#ffffff');
    rect(g, x + 42, y + 26, 16, 14, '#14324d'); rect(g, x + 43, y + 27, 14, 13, '#ffe9a0');
    rect(g, x + 49, y + 27, 1, 13, '#14324d');
  }
  function clawMini(g, x, y, cab) {
    rect(g, x, y, 13, 12, '#14324d'); rect(g, x + 1, y + 1, 11, 10, cab);
    rect(g, x + 2, y + 2, 9, 5, '#dff1ff');
    plush(g, x + 3, y + 4, '#ff9fc2'); plush(g, x + 7, y + 4, '#ffd84a');
    rect(g, x + 2, y + 8, 9, 2, '#0b1e30');
  }

  // ---------- 진행 ----------
  function start(now, done) {
    st = { done, si: -1, i: 0, say: null, block: null, phase: 'in', pt: now, last: now, actors: [], emotes: [], crowd: [],
      light: null, flash: 0, shake: 0, title: null, wait: 0, props: [], bg: 'arcade', t0: now };
    if (!arcadeImg) buildArcade();
    nextScene(now);
  }

  function nextScene(now) {
    st.si++;
    if (st.si >= DATA.STORY.length) { const d = st.done; st = null; if (d) d(); return; }
    const sc = DATA.STORY[st.si];
    st.bg = sc.bg; st.light = sc.light || null; st.props = sc.props || [];
    st.actors = sc.actors.map((a) => Object.assign({ mv: null }, a));
    st.crowd = makeCrowd(sc.crowd || 0);
    st.emotes = []; st.say = null; st.block = null; st.title = null; st.i = 0;
    st.phase = 'in'; st.pt = now;
  }

  const actor = (id) => st.actors.find((a) => a.id === id);

  function runSteps(now) {
    const sc = DATA.STORY[st.si];
    for (let guard = 0; guard < 100; guard++) {
      const s = sc.steps[st.i];
      if (!s) { st.phase = 'out'; st.pt = now; return; }
      const op = s[0];
      if (op === 'narr') { st.say = { tag: '', text: s[1], t0: now }; st.block = 'say'; return; }
      if (op === 'say') { st.say = { tag: s[1], text: s[2], t0: now }; st.block = 'say'; return; }
      if (op === 'wait') { st.wait = now + s[1]; st.block = 'wait'; return; }
      if (op === 'title') { st.title = { main: s[1], sub: s[2] || '', t0: now }; st.block = 'title'; return; }
      if (op === 'move') {
        const a = actor(s[1]);
        if (a) a.mv = { to: s[2], spd: s[3] || 30 };
        if (s[4] === true) { st.block = 'move'; return; }
      } else if (op === 'emote') st.emotes.push({ id: s[1], ch: s[2], t0: now });
      else if (op === 'flash') st.flash = 1;
      else if (op === 'shake') st.shake = s[1];
      st.i++;
    }
  }

  function endBlock(now) { st.block = null; st.say = null; st.title = null; st.i++; runSteps(now); }

  function update(now) {
    const dt = Math.min(0.1, now - st.last);
    st.last = now;
    st.flash = Math.max(0, st.flash - dt * 2.5);
    st.shake = Math.max(0, st.shake - dt * 8);
    st.actors.forEach((a) => {
      if (!a.mv) return;
      const d = a.mv.to - a.x, stepLen = a.mv.spd * dt;
      if (Math.abs(d) <= stepLen) { a.x = a.mv.to; a.mv = null; } else a.x += Math.sign(d) * stepLen;
    });
    if (st.phase === 'in' && now - st.pt >= FADE) { st.phase = 'run'; runSteps(now); }
    else if (st.phase === 'out' && now - st.pt >= FADE) { nextScene(now); return; }
    if (st.phase === 'run') {
      if (st.block === 'wait' && now >= st.wait) endBlock(now);
      else if (st.block === 'move' && !st.actors.some((a) => a.mv)) endBlock(now);
      else if (st.block === 'title' && now - st.title.t0 >= TITLE_TIME) endBlock(now);
    }
  }

  // 클릭 / Space / Enter
  function advance(now) {
    if (!st || st.phase !== 'run') return;
    if (st.block === 'say') {
      if ((now - st.say.t0) * CFG.TYPE_SPEED < st.say.text.length) { st.say.t0 = now - 999; return; }
      endBlock(now);
    } else if (st.block === 'title' && now - st.title.t0 > 0.5) endBlock(now);
  }

  // ---------- 그리기 ----------
  function draw(ctx, now, W, H, OX) {
    if (!st) return;
    update(now);
    if (!st) return; // 마지막 장면이 끝나 done이 호출된 경우
    const sc = Scene.geom(W, H);
    const t = now - st.t0;
    ctx.save();
    if (st.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * st.shake * 2), Math.round((Math.random() - 0.5) * st.shake * 2));
    ctx.imageSmoothingEnabled = false;
    if (st.bg === 'arcade') ctx.drawImage(arcadeImg, sc.ox, sc.oy, LW * sc.sc, GH * sc.sc);
    else Scene.draw(ctx, t, W, H, st.bg);

    // 인물·소품 층
    if (!px) { px = document.createElement('canvas'); px.width = LW; px.height = GH; pg = px.getContext('2d'); }
    pg.clearRect(0, 0, LW, GH);
    pg.save();
    pg.translate(EXT, 0);
    if (st.props.indexOf('shop') >= 0) drawShop(pg);
    if (st.bg === 'arcade') {
      // 주인공이 하는 기계의 집게(위아래로 움직인다)
      const cx = HERO_X + 8 + Math.round((Math.sin(t * 0.9) * 0.5 + 0.5) * 14);
      const dy = Math.round(Math.max(0, Math.sin(t * 1.4)) * 11);
      const top = HERO_Y + 2;
      rect(pg, cx, top + 15, 1, 6 + dy, '#44505c');
      rect(pg, cx - 2, top + 21 + dy, 5, 1, '#44505c'); rect(pg, cx - 2, top + 22 + dy, 1, 2, '#44505c'); rect(pg, cx + 2, top + 22 + dy, 1, 2, '#44505c');
    }
    const list = st.crowd.map((p) => ({ y: p.y, f: () => drawPerson(pg, p, t) }))
      .concat(st.actors.map((a) => ({ y: a.y, f: () => {
        const hop = a.mv ? (Math.floor(t * 8) % 2) : 0;
        drawRows(pg, ME, ME_PAL, Math.round(a.x - 6), a.y - 20 - hop);
      } })));
    list.sort((a, b) => a.y - b.y).forEach((o) => o.f());
    st.emotes = st.emotes.filter((e) => now - e.t0 < 1.6);
    st.emotes.forEach((e) => {
      const a = actor(e.id); if (!a) return;
      const k = Math.min(1, (now - e.t0) / 0.25);
      drawIcon(pg, e.ch, Math.round(a.x), Math.round(a.y - 36 - 5 * k + (Math.floor((now - e.t0) * 6) % 2)));
    });
    pg.restore();
    ctx.drawImage(px, sc.ox, sc.oy, LW * sc.sc, GH * sc.sc);

    if (st.light === 'dusk') { ctx.fillStyle = 'rgba(255,140,60,0.28)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    if (st.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + st.flash + ')'; ctx.fillRect(0, 0, W, H); }

    // 대사창
    ctx.save();
    ctx.translate(OX, 0);
    if (st.say && st.phase === 'run') {
      const L = CFG.LAYOUT.cutDialog;
      const full = st.say.text;
      const chars = Math.floor((now - st.say.t0) * CFG.TYPE_SPEED);
      let left = chars;
      const lines = UI.wrap(full, L.w - 60, 26).map((s) => { const part = s.slice(0, Math.max(0, left)); left -= s.length; return part; });
      UI.dialog(L, st.say.tag, lines, chars >= full.length, now);
    }
    ctx.restore();

    // 타이틀 카드
    if (st.title) {
      const k = now - st.title.t0;
      const a = Math.min(1, k / 0.5, (TITLE_TIME - k) / 0.5);
      ctx.fillStyle = 'rgba(10,30,50,' + 0.78 * Math.max(0, a) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(OX, 0);
      UI.text(st.title.sub, 480, 232, 22, '#cfe3f5');
      UI.text(st.title.main, 480, 292, 52, C.white, 'center', C.ink);
      UI.rect(430, 334, 100, 4, C.yellow);
      ctx.restore();
    }

    // 장면 전환 페이드
    let fade = 0;
    if (st.phase === 'in') fade = 1 - Math.min(1, (now - st.pt) / FADE);
    else if (st.phase === 'out') fade = Math.min(1, (now - st.pt) / FADE);
    if (fade > 0) { ctx.fillStyle = 'rgba(8,20,34,' + fade + ')'; ctx.fillRect(0, 0, W, H); }
  }

  return { start, draw, advance, active: () => !!st };
})();
