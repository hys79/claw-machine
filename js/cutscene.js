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
  let phoneImg = null;
  let streetImg = null;
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

  // ---------- 대사 속 이름 끼워 넣기 ----------
  // {name} {shop}은 이름 그대로, {이:shop} {은:name} {을:shop}은 그 이름의 받침에 맞는 조사(이/가, 은/는, 을/를)만 붙인다.
  const JOSA = { '이': ['이', '가'], '은': ['은', '는'], '을': ['을', '를'] };
  function fmt(text) {
    const d = State.data || {};
    const get = (key) => (key === 'name' ? d.playerName : d.shopName) || '';
    const vars = (st && st.vars) || {};
    return String(text).replace(/\{(trend|dolls)\}/g, (m, key) => vars[key] || '').replace(/\{(name|shop)\}|\{(이|은|을):(name|shop)\}/g, (m, key, jo, key2) => {
      if (key) return get(key);
      const word = get(key2);
      const code = word.charCodeAt(word.length - 1) - 0xAC00;
      const batchim = code >= 0 && code <= 11171 && code % 28 !== 0;
      return JOSA[jo][batchim ? 0 : 1];
    });
  }

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

  // 주인공(14x21 + 자동 테두리). 머리가 큰 캐주얼 파란 후드티 캐릭터. 정면 / 뒷모습(기계를 할 때).
  const ME_FRONT = [
    '....hhhhhh....',
    '..hhhhhhhhhh..',
    '.hhhHHhhhhhhh.',
    '.hhhhhhhhhhhh.',
    '.hssssssssssh.',
    '.hsKwssssKwsh.',
    '.hsKKssssKKsh.',
    '.hccssmmsscch.',
    '..hssssssssh..',
    '...ssssssss...',
    '..bbbbbbbbbb..',
    '.SSSSSSSSSSSS.',
    '.bbbbbbbbbbbb.',
    '.SSSSSSSSSSSS.',
    '.ssbbbbbbbbss.',
    '...SSSSSSSS...',
    '...BBBBBBBB...',
    '...ppp..ppp...',
    '...ppp..ppp...',
    '..dddd..dddd..',
    '..dddd..dddd..',
  ];
  const ME_BACK = [
    '....hhhhhh....',
    '..hhhhhhhhhh..',
    '.hhhHHhhhhhhh.',
    '.hhhhhhhhhhhh.',
    '.hhhhhhhhhhhh.',
    '.shhhhhhhhhhs.',
    '.shhhhhhhhhhs.',
    '.hhhhhhhhhhhh.',
    '..hhhhhhhhhh..',
    '...hhhhhhhh...',
    '..bbbbbbbbbb..',
    '.bbbBBBBBBbbb.',
    'bbbbbbBBbbbbbb',
    '.SSSSSSSSSSSS.',
    '...bbbbbbbb...',
    '...SSSSSSSS...',
    '...BBBBBBBB...',
    '...ppp..ppp...',
    '...ppp..ppp...',
    '..dddd..dddd..',
    '..dddd..dddd..',
  ];
  // 멀리서 본 주인공(아레나·공사장 장면): 구경꾼과 같은 키(약 12칸)
  const ME_MINI = [
    '..hhhh..',
    '.hhhhhh.',
    '.hssssh.',
    '.hKssKh.',
    '.hssssh.',
    '..ssss..',
    '.SSSSSS.',
    'sbbbbbbs',
    '.SSSSSS.',
    '.pp..pp.',
    '.dd..dd.',
  ];
  // 옆모습(오른쪽을 보고 걷는다. 왼쪽은 좌우 반전). 몸통 + 팔 + 다리를 조합해 걷기 4프레임을 만든다.
  const SIDE_BASE = [
    '....hhhhhh....',
    '..hhhhhhhhhh..',
    '.hhhHHhhhhhhh.',
    '.hhhhhhhhhhhh.',
    '.hhhhhsssssss.',
    '.hhhhhssKwsss.',
    '.hhhhhssKKsss.',
    '.hhhhhsccssms.',
    '..hhhhssssss..',
    '....hsssss....',
    '....bbbbbbb...',
    '....SSSSSSS...',
    '....bbbbbbb...',
    '....SSSSSSS...',
    '....bbbbbbb...',
    '....SSSSSSS...',
    '....BBBBBBB...',
  ];
  const SIDE_LEGS = {
    wide: ['....pppppp....', '...ppp..ppp...', '..ppp....ppp..', '.dddd....dddd.'],
    pass: ['....pppppp....', '....pppppp....', '....ppp.pp....', '....ddd.dd....'],
  };
  const SIDE_ARMS = { // [x, y, 글자]: 팔(밝은 소매 t, 손 s)
    fwd: [[8, 12, 'B'], [9, 12, 'B'], [9, 13, 'B'], [10, 13, 'B'], [10, 14, 'B'], [11, 14, 's'], [11, 15, 's']],
    back: [[5, 12, 'B'], [6, 12, 'B'], [4, 13, 'B'], [5, 13, 'B'], [3, 14, 'B'], [3, 15, 's'], [2, 15, 's']],
    down: [[7, 12, 'B'], [7, 13, 'B'], [7, 14, 'B'], [7, 15, 's'], [8, 15, 's']],
  };
  function sideFrame(arm, legs) {
    const rows = SIDE_BASE.concat(SIDE_LEGS[legs]).map((r) => r.split(''));
    SIDE_ARMS[arm].forEach((c) => { rows[c[1]][c[0]] = c[2]; });
    return rows.map((r) => r.join(''));
  }
  const ME_WALK = [sideFrame('fwd', 'wide'), sideFrame('down', 'pass'), sideFrame('back', 'wide'), sideFrame('down', 'pass')];
  // 멀리서 본 주인공의 옆모습(2프레임)
  const ME_MINI_WALK = [
    ['..hhhh..', '.hhhhhh.', '.hhhsss.', '.hhhsKs.', '..hhsss.', '...sss..', '..SSSS..', '..bbbs..', '..SSSS..', '.pp..pp.', '.dd..dd.'],
    ['..hhhh..', '.hhhhhh.', '.hhhsss.', '.hhhsKs.', '..hhsss.', '...sss..', '..SSSS..', '.sbbbb..', '..SSSS..', '..pppp..', '..dddd..'],
  ];
  // 눈 깜빡임(정면): 눈 두 줄을 한 줄 선으로
  const ME_BLINK = ME_FRONT.map((r, i) => (i === 5 ? '.hssssssssssh.' : r));
  const ME_PAL = { h: '#4a3426', H: '#7a5640', s: '#ffd9b5', c: '#ff9fa0', m: '#c0584a', K: '#14324d', w: '#ffffff',
    b: '#3f8fe0', B: '#2c6cb8', t: '#7fbdf5', S: '#ffffff', y: '#ffd84a', p: '#3b5878', d: '#14324d' };

  // 이상한 양복 사내(인형뽑기 애호가 클럽 회장): 주황 작은 모자, 둥근 안경, 흰 수염, 청록 양복에 주황 넥타이
  const SUIT_FRONT = ME_FRONT.map((r, i) => ({
    0: '....yyyyyy....',
    4: '.hKKKssssKKKh.',
    5: '.hKwKssssKwKh.',
    6: '.hKKKssssKKKh.',
    7: '.hssMMmmMMssh.',
    11: '.bbbbbyybbbbb.',
    12: '.bbbbbyybbbbb.',
    13: '.bbbbbyybbbbb.',
  }[i] || r));
  const SUIT_PAL = Object.assign({}, ME_PAL, { h: '#d6d6d6', H: '#ffffff', M: '#f2f2f2', b: '#2aa198', B: '#1f7a73', S: '#2aa198', t: '#4cc4ba', y: '#ff8a3d', p: '#3a3a5c', c: '#ffd9b5' });
  // 옆모습에서도 모자가 보이게: 윗줄 두 칸을 주황 모자(챙은 앞쪽으로 튀어나옴)로
  // 안경(둥근 테)도 옆에서 보이게: 눈 둘레를 어두운 테로 두르고 귀 쪽으로 다리를 뺀다
  const SUIT_SIDE = { 0: '.....yyyyyy...', 1: '..yyyyyyyyyyyy', 4: '.hhhhhsKKKKss.', 5: '.hhhhhKKKwKss.', 6: '.hhhhhsKKKKss.', 7: '.hhhhhsscMMms.' };
  const SUIT_WALK = ME_WALK.map((f) => f.map((r, i) => SUIT_SIDE[i] || r));
  const KINDS = {
    me: { front: ME_FRONT, blink: ME_BLINK, pal: ME_PAL, walk: ME_WALK },
    suit: { front: SUIT_FRONT, blink: SUIT_FRONT, pal: SUIT_PAL, walk: SUIT_WALK },
  };


  // 도트를 한 번만 이미지로 만들고, 바깥에 ink 테두리 1칸을 자동으로 두른다(스티커 같은 모양).
  const spriteImgs = new Map();
  function outlinedImg(rows, pal) {
    pal = pal || ME_PAL;
    let byPal = spriteImgs.get(rows);
    if (!byPal) { byPal = new Map(); spriteImgs.set(rows, byPal); }
    let img = byPal.get(pal);
    if (img) return img;
    const w = rows[0].length, h = rows.length;
    img = document.createElement('canvas');
    img.width = w + 2; img.height = h + 2;
    const g = img.getContext('2d');
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) rect(g, x + 1, y + 1, 1, 1, '#14324d');
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = pal[rows[y][x]];
      if (c) rect(g, x + 1, y + 1, 1, 1, c);
    }
    byPal.set(pal, img);
    return img;
  }

  // 가운데 x에 맞춰 그린다. flip이면 좌우 반전(왼쪽을 보고 걷는 모습).
  function drawFacing(g, img, cx, y, flip) {
    if (!flip) { g.drawImage(img, Math.round(cx - img.width / 2), y); return; }
    g.save();
    g.translate(Math.round(cx + img.width / 2), 0);
    g.scale(-1, 1);
    g.drawImage(img, 0, y);
    g.restore();
  }

  function drawRows(g, rows, pal, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) rect(g, x + i, y + j, 1, 1, c);
      }
    });
  }

  // 핸드폰 뉴스 장면의 배경(은은한 빛 + 줄무늬)
  function buildPhoneBg() {
    const img = document.createElement('canvas');
    img.width = LW; img.height = GH;
    const g = img.getContext('2d');
    for (let y = 0; y < GH; y++) rect(g, 0, y, LW, 1, y < 70 ? '#d9e8f6' : '#c3daef');
    for (let x = 0; x < LW; x += 12) rect(g, x, 0, 6, GH, 'rgba(255,255,255,0.18)');
    for (let r = 58; r > 10; r -= 12) {
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let y = -r; y <= r; y++) { const half = Math.round(r * Math.sqrt(1 - (y * y) / (r * r))); g.fillRect(LW / 2 - half, 54 + y, half * 2, 1); }
    }
    phoneImg = img;
  }

  const TINY = { N: ['#.#', '###', '###', '#.#', '#.#'], E: ['###', '#..', '##.', '#..', '###'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'], S: ['.##', '#..', '.#.', '..#', '##.'] };
  function tinyText(g, str, x, y, c) {
    for (const ch of str) {
      const rows = TINY[ch];
      rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') rect(g, x + i, y + j, 1, 1, c); });
      x += rows[0].length + 1;
    }
  }

  // 핸드폰 화면(속보 뉴스). t: 장면 시작 후 시간(초) - 처음에는 진동한다.
  function drawPhone(g, t) {
    const sh = t < 1.2 ? Math.round(Math.sin(t * 60)) : 0;
    const x0 = 92 + sh, y0 = 4, w = 56, h = 100;
    rect(g, x0 - 1, y0 - 1, w + 2, h + 2, '#14324d');
    rect(g, x0, y0, w, h, '#2d4a66');
    rect(g, x0 + 22, y0 + 1, 12, 1, '#14324d');
    const sx = x0 + 3, sy = y0 + 4, sw = 50;
    rect(g, sx, sy, sw, h - 8, '#ffffff');
    rect(g, sx, sy, sw, 10, '#2f80d0');
    tinyText(g, 'NEWS', sx + 4, sy + 2, '#ffffff');
    rect(g, sx + sw - 8, sy + 3, 4, 4, Math.floor(t * 2) % 2 ? '#ffd84a' : '#ffffff');
    rect(g, sx, sy + 11, sw, 7, Math.floor(t * 3) % 2 ? '#d9455f' : '#ef7a8f');
    rect(g, sx + 3, sy + 13, 2, 3, '#ffffff'); rect(g, sx + 3, sy + 17, 2, 1, '#ffffff');
    rect(g, sx + 8, sy + 14, 36, 1, '#ffffff'); rect(g, sx + 8, sy + 16, 24, 1, '#ffffff');
    // 사진: 아레나 그림
    rect(g, sx + 2, sy + 20, sw - 4, 26, '#cfe8f8');
    rect(g, sx + 2, sy + 40, sw - 4, 6, '#8ad67e');
    for (let yy = -4; yy <= 4; yy++) { const half = Math.round(15 * Math.sqrt(1 - (yy * yy) / 16)); rect(g, sx + 25 - half, sy + 27 + yy, half * 2, 1, '#78c47a'); }
    rect(g, sx + 10, sy + 27, 30, 10, '#9fd6e8');
    for (let xx = sx + 11; xx < sx + 40; xx += 3) rect(g, xx, sy + 28, 1, 9, '#6ab6d6');
    for (let yy = -4; yy <= 4; yy++) { const half = Math.round(15 * Math.sqrt(1 - (yy * yy) / 16)); rect(g, sx + 25 - half, sy + 36 + yy, half * 2, 1, '#9fd6e8'); }
    rect(g, sx + 20, sy + 31, 10, 5, '#ffe9a0');
    // 제목·본문 줄
    rect(g, sx + 2, sy + 50, sw - 4, 3, '#14324d'); rect(g, sx + 2, sy + 55, 30, 3, '#14324d');
    for (let i = 0; i < 6; i++) rect(g, sx + 2, sy + 62 + i * 5, sw - 4 - (i % 3) * 8, 2, '#c9d9e6');
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
        x0: r() * 114, y: 97 + Math.floor(r() * 9), speed: (r() < 0.5 ? -1 : 1) * (4 + r() * 6),
        skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)],
        cloth: CLOTH[Math.floor(r() * CLOTH.length)], pants: r() < 0.5 ? '#2d4a66' : '#5a4a3a',
        h: 9 + Math.floor(r() * 3), flag: r() < 0.3 ? CLOTH[Math.floor(r() * CLOTH.length)] : null,
      });
    }
    list.sort((a, b) => a.y - b.y);
    return list;
  }
  const CROWD_LO = 64, CROWD_W = 112;
  function drawPerson(g, p, t) {
    const x = Math.round(CROWD_LO + ((((p.x0 + p.speed * t) % CROWD_W) + CROWD_W) % CROWD_W)); // 광장(테라스) 안에서만 돌아다닌다(물가·풀밭 제외)
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

  // ---------- 가게 장면: 거리(사람 키에 맞는 자연스러운 스케일) ----------
  const lerpHex = (a, b, t) => {
    const A = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };
  const ellipseFill = (g, cx, cy, rx, ry, c) => {
    for (let y = -ry; y <= ry; y++) { const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); rect(g, cx - half, cy + y, half * 2 + 1, 1, c); }
  };
  const GROUND = 98; // 인도 시작 높이

  // 건물 한 채: 창문 격자와 가게 간판 없는 이웃 상점
  function neighbor(g, x, w, top, wall, trim, awning) {
    rect(g, x - 1, top - 1, w + 2, GROUND - top + 1, '#14324d');
    rect(g, x, top, w, GROUND - top, wall);
    rect(g, x, top, w, 3, trim);
    for (let wy = top + 8; wy < GROUND - 28; wy += 14) for (let wx = x + 5; wx < x + w - 8; wx += 14) {
      rect(g, wx, wy, 8, 9, '#14324d'); rect(g, wx + 1, wy + 1, 6, 7, '#bfe3f7'); rect(g, wx + 1, wy + 1, 6, 2, '#e9f6fd');
    }
    // 1층 상점: 차양 + 유리
    const sy = GROUND - 28;
    for (let i = 0; i < w; i += 6) { rect(g, x + i, sy, 3, 5, awning); rect(g, x + i + 3, sy, 3, 5, '#ffffff'); }
    rect(g, x, sy + 5, w, 1, '#14324d');
    rect(g, x + 4, sy + 8, w - 8, 16, '#14324d'); rect(g, x + 5, sy + 9, w - 10, 14, '#d9eefb');
  }

  // o: {sky [위, 아래], cloud, cloudShade, overcast, leaf [테두리, 잎, 밝은 잎], bare, snow, walk, road, night}
  function buildStreetBg(o) {
    o = o || {};
    const sky = o.sky || ['#6fbdf0', '#dcefff'], leaf = o.leaf || ['#2d7a47', '#3f9a55', '#6cc070'];
    const lit = []; // 밤에 불 켜진 창
    const img = document.createElement('canvas');
    img.width = LW; img.height = GH;
    const g = img.getContext('2d');
    g.translate(EXT, 0);
    for (let y = 0; y < 74; y++) rect(g, -EXT, y, LW, 1, lerpHex(sky[0], sky[1], y / 74));
    const cloud = o.cloud || '#ffffff', shade = o.cloudShade || '#d6e6f4';
    const clouds = [[10, 10, 30], [90, 6, 24], [170, 14, 34], [-30, 20, 26], [230, 8, 30]];
    if (o.overcast) clouds.push([48, 2, 40], [128, 12, 36], [-52, 4, 34], [268, 18, 30]);
    clouds.forEach((c) => {
      rect(g, c[0] + 2, c[1] + 3, c[2] - 4, 3, cloud); rect(g, c[0], c[1] + 4, c[2], 2, cloud); rect(g, c[0] + 5, c[1] + 1, 9, 3, cloud); rect(g, c[0] + 2, c[1] + 6, c[2] - 4, 1, shade);
    });
    // 멀리 보이는 아파트 숲
    const r = rngMaker(77);
    for (let x = -EXT; x < GW + EXT;) {
      const w = 9 + Math.floor(r() * 5), h = 14 + Math.floor(r() * 26);
      rect(g, x, 76 - h, w, h, ['#b9cde0', '#adc3d8', '#c6d6e6'][Math.floor(r() * 3)]);
      for (let wy = 76 - h + 3; wy < 74; wy += 3) for (let wx = x + 1; wx < x + w - 2; wx += 3) { const v = r(); rect(g, wx, wy, 1, 1, v < 0.15 ? '#ffe2a0' : '#e8f1f8'); if (v < 0.45) lit.push([wx, wy]); }
      if (o.snow) rect(g, x, 76 - h, w, 2, '#ffffff');
      x += w + 1;
    }
    // 멀리 보이는 창동 아레나(오른쪽 위, 건물 뒤로 살짝)
    const cx = 196;
    for (let x = cx - 32; x <= cx + 32; x++) {
      const dx = (x - cx) / 32, arc = Math.round(5 * Math.sqrt(Math.max(0, 1 - dx * dx)));
      for (let y = 52 + arc; y <= 74 + arc; y++) rect(g, x, y, 1, 1, (Math.floor((x - cx + 32) / 3) % 2) ? '#a6d2e6' : '#8fc3dc');
      rect(g, x, 50 + arc, 1, 3, '#e6edf4');
    }
    ellipseFill(g, cx, 52, 31, 5, '#e6edf4'); ellipseFill(g, cx, 52, 27, 4, '#9ed49a'); ellipseFill(g, cx, 52, 16, 2, '#4f86e0');
    // 이웃 건물
    neighbor(g, -64, 118, 30, '#ecdfca', '#c9b79a', '#4aa38c');   // 왼쪽(베이지) - 가게 뒤까지 이어진다
    neighbor(g, 184, 118, 24, '#d9e7f4', '#aac0d6', '#e8776a');   // 오른쪽(연한 파랑)
    // 인도 + 연석 + 도로
    for (let y = GROUND; y < 112; y++) rect(g, -EXT, y, LW, 1, y === GROUND ? '#b9c6d4' : o.snow ? '#ffffff' : o.walk || '#e6ebf1');
    for (let x = -EXT; x < GW + EXT; x += 20) rect(g, x, GROUND + 1, 1, 12, '#cfd8e2');
    rect(g, -EXT, 108, LW, 4, '#aab7c6'); rect(g, -EXT, 108, LW, 1, '#d5dde6');
    for (let y = 112; y < GH; y++) rect(g, -EXT, y, LW, 1, o.snow ? '#a9b6c4' : o.road || '#7d8a99');
    for (let x = -EXT; x < GW + EXT; x += 28) rect(g, x, 128, 14, 2, '#f1f4f7');
    if (o.snow) { rect(g, -64, 30, 118, 2, '#ffffff'); rect(g, 184, 24, 118, 2, '#ffffff'); } // 지붕의 눈
    if (o.night) { // 어둡게 덮은 뒤 불빛을 다시 켠다
      rect(g, -EXT, 0, LW, GH, 'rgba(18,26,70,0.42)');
      lit.forEach((p) => { if (p[0] > 54 && p[0] < 164) rect(g, p[0], p[1], 1, 1, '#ffd873'); });
      [[-64, 118, 30], [184, 118, 24]].forEach((b) => {
        for (let wy = b[2] + 8, i = 0; wy < GROUND - 28; wy += 14) for (let wx = b[0] + 5; wx < b[0] + b[1] - 8; wx += 14, i++) if (i % 3) rect(g, wx + 1, wy + 1, 6, 7, '#ffd873');
        rect(g, b[0] + 5, GROUND - 19, b[1] - 10, 14, 'rgba(255,225,140,0.55)');
      });
    }
    // 가로수(밤의 불빛보다 앞에 있으므로 마지막에 그린다)
    const trunk = o.night ? '#463a4c' : '#7a5230';
    [[40, 108], [206, 108]].forEach((t) => {
      rect(g, t[0] - 1, t[1] - 14, 3, 14, trunk);
      if (o.bare) { // 겨울의 앙상한 가지
        rect(g, t[0] - 1, t[1] - 30, 3, 16, trunk);
        [[-9, -22, 8], [2, -26, 8], [-6, -30, 5], [2, -18, 7]].forEach((b) => { rect(g, t[0] + b[0], t[1] + b[1], b[2], 2, trunk); if (o.snow) rect(g, t[0] + b[0], t[1] + b[1] - 1, b[2], 1, '#ffffff'); });
        return;
      }
      ellipseFill(g, t[0], t[1] - 22, 11, 11, leaf[0]); ellipseFill(g, t[0], t[1] - 22, 10, 10, leaf[1]);
      ellipseFill(g, t[0] - 3, t[1] - 25, 5, 5, o.snow ? '#ffffff' : leaf[2]);
    });
    return img;
  }

  // 작은 인형뽑기 기계(14x26): 쇼윈도 안
  function clawSmall(g, x, y, cab, seed) {
    const r = rngMaker(seed);
    rect(g, x, y, 14, 26, '#14324d'); rect(g, x + 1, y + 1, 12, 24, cab);
    rect(g, x + 2, y + 2, 10, 3, '#ffd84a');
    rect(g, x + 2, y + 6, 10, 11, '#14324d'); rect(g, x + 3, y + 7, 8, 9, '#e3f3ff');
    for (let k = 0; k < 5; k++) plush(g, x + 3 + Math.floor(r() * 4), y + 11 + Math.floor(r() * 3), PLUSH[Math.floor(r() * PLUSH.length)]);
    rect(g, x + 7, y + 8, 1, 3, '#44505c');
    rect(g, x + 2, y + 18, 10, 3, '#14324d'); rect(g, x + 3, y + 19, 2, 1, '#ff5a5a'); rect(g, x + 8, y + 19, 3, 1, '#ffd84a');
    rect(g, x + 3, y + 22, 8, 3, '#0b1e30');
  }

  // 우리 가게(폭 120). 간판에는 플레이어가 지은 가게 이름이 들어간다.
  // o: 하루의 시작·끝 장면에서만 준다. {shutter 0(올림)~1(내림), night, snow}
  function drawStreetShop(g, t, name, o) {
    const x0 = 60, w = 120, top = 26;
    rect(g, x0 - 3, top - 1, w + 6, GROUND - top + 1, '#14324d');
    rect(g, x0 - 2, top, w + 4, 5, '#2f80d0'); rect(g, x0 - 2, top, w + 4, 1, '#6ab0f0');
    rect(g, x0, top + 5, w, GROUND - top - 5, '#f7fbfe'); rect(g, x0 + w - 4, top + 5, 4, GROUND - top - 5, '#e1ebf3');
    // 간판: 이름을 짓기 전에는 빈 간판
    const sw = w - 8, sx = Math.round(x0 + w / 2 - sw / 2); // 간판 크기는 고정(이름 글자는 화면에서 크기를 맞춰 그린다)
    rect(g, sx - 1, top + 6, sw + 2, 20, '#14324d'); rect(g, sx, top + 7, sw, 18, '#2f80d0'); rect(g, sx, top + 7, sw, 2, '#6ab0f0');
    if (name) {
      for (let i = 0; i < 2; i++) { const sxp = i ? sx + sw + 4 : sx - 7; if (Math.floor(t * 2) % 2) { rect(g, sxp, top + 15, 3, 1, '#ffd84a'); rect(g, sxp + 1, top + 14, 1, 3, '#ffd84a'); } }
    }
    // 차양
    const ay = top + 27;
    for (let i = 0; i < w; i += 8) { rect(g, x0 + i, ay, 4, 8, '#2f80d0'); rect(g, x0 + i + 4, ay, 4, 8, '#ffffff'); rect(g, x0 + i + (i % 16 ? 4 : 0), ay + 8, 4, 2, i % 16 ? '#ffffff' : '#2f80d0'); }
    rect(g, x0, ay + 10, w, 1, '#c9d3de');
    // 쇼윈도(왼쪽): 기계 둘
    const wy = top + 40, wh = GROUND - 6 - wy;
    rect(g, x0 + 5, wy - 1, 50, wh + 2, '#14324d'); rect(g, x0 + 6, wy, 48, wh, '#d6edfc'); rect(g, x0 + 6, wy, 48, 3, '#eef8ff');
    clawSmall(g, x0 + 10, GROUND - 7 - 26, '#2f80d0', 5); clawSmall(g, x0 + 32, GROUND - 7 - 26, '#ffffff', 9);
    // 문
    const dx = x0 + 62;
    rect(g, dx - 1, top + 36, 26, GROUND - top - 36, '#14324d'); rect(g, dx, top + 37, 24, GROUND - top - 37, '#ffe9a0');
    rect(g, dx + 11, top + 37, 2, GROUND - top - 37, '#14324d'); rect(g, dx + 8, top + 60, 2, 5, '#14324d'); rect(g, dx + 14, top + 60, 2, 5, '#14324d');
    rect(g, dx + 3, top + 42, 18, 9, '#14324d'); rect(g, dx + 4, top + 43, 16, 7, '#d9455f');
    tinyText(g, 'OPEN', dx + 5, top + 44, '#ffffff');
    // 쇼윈도(오른쪽): 인형 선반
    const rx = x0 + 92;
    rect(g, rx - 1, wy - 1, 26, wh + 2, '#14324d'); rect(g, rx, wy, 24, wh, '#d6edfc');
    [wy + 10, wy + 20].forEach((yy) => rect(g, rx, yy, 24, 2, '#8fa9be'));
    for (let i = 0; i < 4; i++) plush(g, rx + 2 + i * 6, wy + 5, PLUSH[i]);
    for (let i = 0; i < 4; i++) plush(g, rx + 2 + i * 6, wy + 15, PLUSH[(i + 2) % PLUSH.length]);
    // 바닥 띠와 화분
    rect(g, x0, GROUND - 4, w, 4, '#c9d3de');
    [x0 - 8, x0 + w + 3].forEach((px2) => { rect(g, px2, GROUND - 6, 6, 6, '#c97a4a'); ellipseFill(g, px2 + 3, GROUND - 10, 4, 4, '#3f9a55'); ellipseFill(g, px2 + 2, GROUND - 11, 2, 2, '#6cc070'); });
    if (!o) return;
    if (o.snow) { rect(g, x0 - 3, top - 3, w + 6, 3, '#ffffff'); [x0 - 8, x0 + w + 3].forEach((px2) => rect(g, px2, GROUND - 15, 6, 2, '#ffffff')); }
    if (o.night) rect(g, x0 - 3, top - 1, w + 6, GROUND - top + 1, 'rgba(18,26,70,' + (0.18 + 0.3 * o.shutter) + ')');
    const from = wy - 1, sh = Math.round((GROUND - 4 - from) * o.shutter); // 셔터
    if (sh > 0) {
      rect(g, x0 + 3, from, w - 6, sh, o.night ? '#6a7a92' : '#9fb0c0');
      for (let y = 3; y < sh; y += 4) rect(g, x0 + 3, from + y, w - 6, 1, o.night ? '#4a5a72' : '#7a8ea2');
      rect(g, x0 + 3, from + sh - 1, w - 6, 1, '#14324d');
    }
  }

  // 거리의 행인들: 주인공과 같은 모양, 머리·옷 색만 다르다(자연스러운 같은 스케일)
  const NPC_PALS = [
    { h: '#2b1b10', H: '#4a3426', b: '#e0556f', B: '#b03a52', t: '#f08a9c' },
    { h: '#d9a04a', H: '#f0c070', b: '#6bc16a', B: '#4a9a4a', t: '#98d98f' },
    { h: '#1c1c1c', H: '#3a3a3a', b: '#f2b84b', B: '#c88f20', t: '#ffd98a', s: '#c68642' },
    { h: '#a3522a', H: '#c27040', b: '#a56bd8', B: '#7e4cb0', t: '#c79ae8' },
    { h: '#3b2a20', H: '#5c4333', b: '#ffffff', B: '#c9d9e6', t: '#eef4fa', s: '#8d5524' },
  ].map((o) => Object.assign({}, ME_PAL, o, { S: o.b })); // 줄무늬(S)는 주인공만: 행인은 단색 옷
  function makeWalkers(n) {
    const r = rngMaker(909);
    return Array.from({ length: n }, (_, i) => ({ x0: r() * 300, y: 103 + Math.floor(r() * 4), speed: (i % 2 ? -1 : 1) * (16 + r() * 10), pal: NPC_PALS[i % NPC_PALS.length] }));
  }

  // ---------- 진행 ----------
  // hooks: { input(show, rect), value() } - 가게 이름을 적는 HTML 입력칸은 main.js가 맡는다.
  // script를 주지 않으면 프롤로그. vars: 대사에 끼워 넣을 값
  function start(now, done, hooks, script, vars) {
    st = { done, hooks: hooks || {}, script: script || DATA.STORY, vars: vars || {}, inputErr: '', pt0: now, si: -1, i: 0, say: null, block: null, phase: 'in', pt: now, last: now, actors: [], emotes: [], crowd: [],
      light: null, flash: 0, shake: 0, title: null, wait: 0, props: [], bg: 'arcade', t0: now };
    if (!arcadeImg) buildArcade();
    if (!phoneImg) buildPhoneBg();
    if (!streetImg) streetImg = buildStreetBg();
    nextScene(now);
  }

  const AMBIENT_OF = { arcade: 'arcade', site: 'site', arena: 'crowd', street: 'street' };

  function nextScene(now) {
    st.si++;
    if (st.si >= st.script.length) { finish(); return; }
    const sc = st.script[st.si];
    st.bg = sc.bg; st.light = sc.light || null; st.props = sc.props || [];
    st.actors = sc.actors.map((a) => Object.assign({ mv: null }, a));
    st.crowd = makeCrowd(sc.crowd || 0);
    st.walkers = makeWalkers(sc.walkers || 0);
    st.emotes = []; st.say = null; st.block = null; st.title = null; st.i = 0;
    st.phase = 'in'; st.pt = now;
    Sound.ambient(AMBIENT_OF[st.bg]); // 장면에 맞는 주변 소리(배경음악은 한 곡을 계속 재생)
    if (st.si > 0) Sound.sfx('whoosh');
  }

  const actor = (id) => st.actors.find((a) => a.id === id);

  function runSteps(now) {
    const sc = st.script[st.si];
    for (let guard = 0; guard < 100; guard++) {
      const s = sc.steps[st.i];
      if (!s) { st.phase = 'out'; st.pt = now; return; }
      const op = s[0];
      if (op === 'narr') { st.say = { tag: '', text: fmt(s[1]), t0: now }; st.block = 'say'; return; }
      if (op === 'say') { st.say = { tag: fmt(s[1]), color: (DATA.SPEAKER_COLORS || {})[s[1]], text: fmt(s[2]), t0: now }; st.block = 'say'; return; }
      if (op === 'ask') { // 대사 뒤에 가게 이름 입력칸이 뜬다
        st.say = { tag: fmt(s[1]), color: (DATA.SPEAKER_COLORS || {})[s[1]], text: fmt(s[2]), t0: now }; st.block = 'input'; st.inputErr = '';
        if (st.hooks.input) st.hooks.input(true, INPUT_RECT);
        return;
      }
      if (op === 'wait') { st.wait = now + s[1]; st.block = 'wait'; return; }
      if (op === 'title') { st.title = { main: fmt(s[1]), sub: fmt(s[2] || ''), t0: now }; st.block = 'title'; Sound.sfx('fanfare'); return; }
      if (op === 'move') {
        const a = actor(s[1]);
        if (a) a.mv = { to: s[2], spd: (s[3] || 30) * 1.8 };
        if (s[4] === true) { st.block = 'move'; return; }
      } else if (op === 'pose') { const a = actor(s[1]); if (a) a.pose = s[2]; }
      else if (op === 'emote') { st.emotes.push({ id: s[1], ch: s[2], t0: now }); Sound.sfx(s[2] === 'bulb' ? 'ding' : 'pop'); }
      else if (op === 'sfx') Sound.sfx(s[1]);
      else if (op === 'flash') st.flash = 1;
      else if (op === 'shake') st.shake = s[1];
      st.i++;
    }
  }

  // 가게 이름은 대사창 안에서 입력한다(장면을 가리지 않게): 대사 한 줄 아래에 입력칸 + 확정 버튼
  const ASK_DIALOG = { x: 40, y: 408, w: 880, h: 146 };
  const INPUT_RECT = { x: 64, y: 486, w: 668, h: 50 };
  const INPUT_OK = { x: 752, y: 486, w: 144, h: 50 };

  // 가게 이름 확정(확정 버튼 / Enter)
  function submit(now) {
    if (!st || st.block !== 'input') return;
    const name = (st.hooks.value ? st.hooks.value() : '').trim();
    if (!name) { st.inputErr = '가게 이름을 적어 줘!'; return; }
    State.data.shopName = name.slice(0, CFG.SHOP_NAME_MAX);
    if (st.hooks.input) st.hooks.input(false);
    Sound.sfx('sparkle'); // 간판에 이름이 켜진다
    endBlock(now);
  }

  // 건너뛰기: 가게 이름이 아직 없으면 이름 짓는 장면으로, 이미 정했다면 컷신을 끝낸다.
  function skip(now) {
    if (!st) return;
    if (State.data.shopName) { finish(); return; }
    for (let si = 0; si < DATA.STORY.length; si++) {
      const i = DATA.STORY[si].steps.findIndex((x) => x[0] === 'ask');
      if (i < 0) continue;
      st.si = si - 1;
      nextScene(now);
      st.i = i;
      return;
    }
    finish();
  }

  function finish() {
    if (!st) return;
    if (st.hooks.input) st.hooks.input(false);
    Sound.ambient(null);
    const d = st.done; st = null; if (d) d();
  }

  function endBlock(now) { st.block = null; st.say = null; st.title = null; st.i++; runSteps(now); }

  function update(now) {
    const dt = Math.min(0.1, now - st.last);
    st.last = now;
    st.flash = Math.max(0, st.flash - dt * 2.5);
    st.shake = Math.max(0, st.shake - dt * 8);
    if (st.actors.some((a) => a.mv) && now - (st.lastStep || 0) > 0.28) { st.lastStep = now; Sound.sfx('step'); } // 발소리
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
      Sound.sfx('next');
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
    else if (st.bg === 'phone') ctx.drawImage(phoneImg, sc.ox, sc.oy, LW * sc.sc, GH * sc.sc);
    else if (st.bg === 'street') ctx.drawImage(streetImg, sc.ox, sc.oy, LW * sc.sc, GH * sc.sc);
    else Scene.draw(ctx, t, W, H, st.bg);

    // 인물·소품 층
    if (!px) { px = document.createElement('canvas'); px.width = LW; px.height = GH; pg = px.getContext('2d'); }
    pg.clearRect(0, 0, LW, GH);
    pg.save();
    pg.translate(EXT, 0);
    if (st.bg === 'street') drawStreetShop(pg, t, State.data.shopName);
    if (st.bg === 'phone') drawPhone(pg, now - st.pt);
    if (st.bg === 'arcade') {
      // 주인공이 하는 기계의 집게(위아래로 움직인다)
      const cx = HERO_X + 8 + Math.round((Math.sin(t * 0.9) * 0.5 + 0.5) * 14);
      const dy = Math.round(Math.max(0, Math.sin(t * 1.4)) * 11);
      const top = HERO_Y + 2;
      rect(pg, cx, top + 15, 1, 6 + dy, '#44505c');
      rect(pg, cx - 2, top + 21 + dy, 5, 1, '#44505c'); rect(pg, cx - 2, top + 22 + dy, 1, 2, '#44505c'); rect(pg, cx + 2, top + 22 + dy, 1, 2, '#44505c');
    }
    const list = st.crowd.map((p) => ({ y: p.y, f: () => drawPerson(pg, p, t) }))
      .concat((st.walkers || []).map((w) => ({ y: w.y, f: () => {
        const x = Math.round(-30 + ((((w.x0 + w.speed * t) % 300) + 300) % 300));
        const img = outlinedImg(ME_WALK[Math.floor(t * 6 + w.x0) % 4], w.pal);
        rect(pg, x - 7, w.y - 1, 14, 2, 'rgba(20,50,77,0.22)');
        drawFacing(pg, img, x, w.y - img.height + 1 - (Math.floor(t * 12 + w.x0) % 2), w.speed < 0);
      } })))
      .concat(st.actors.map((a) => ({ y: a.y, f: () => {
        const hop = a.mv ? (Math.floor(t * 12) % 2) : 0;
        const blink = (t + a.x * 0.1) % 3.2 > 3.05;
        const mini = a.size === 'mini';
        const walking = !!a.mv;
        if (walking) a.faceLeft = a.mv.to < a.x;
        const kind = KINDS[a.kind || 'me'];
        let rows = mini ? ME_MINI : (a.pose === 'back' ? ME_BACK : (blink ? kind.blink : kind.front));
        if (walking) rows = mini ? ME_MINI_WALK[Math.floor(t * 6) % 2] : kind.walk[Math.floor(t * 6) % 4];
        const side = !walking && !mini && (a.pose === 'sideR' || a.pose === 'sideL'); // 멈춰 서서 옆을 바라보는 자세
        if (side) rows = kind.walk[1];
        const img = outlinedImg(rows, kind.pal);
        rect(pg, Math.round(a.x) - (mini ? 4 : 7), a.y - 1, mini ? 8 : 14, 2, 'rgba(20,50,77,0.22)'); // 발밑 그림자
        drawFacing(pg, img, Math.round(a.x), a.y - img.height + 1 - (walking && !mini ? hop : 0), walking ? a.faceLeft : a.pose === 'sideL');
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
    if (st.bg === 'street' && State.data.shopName) { // 간판의 가게 이름: 화면 해상도의 또렷한 글자(긴 이름은 알아서 작아진다)
      UI.fitText(State.data.shopName, sc.ox + (EXT + 120) * sc.sc, sc.oy + 42 * sc.sc, 104 * sc.sc, 16 * sc.sc, '#ffffff');
    }

    if (st.light === 'dusk') { ctx.fillStyle = 'rgba(255,140,60,0.28)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    if (st.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + st.flash + ')'; ctx.fillRect(0, 0, W, H); }

    // 대사창
    ctx.save();
    ctx.translate(OX, 0);
    if (st.say && st.phase === 'run') {
      const L = st.block === 'input' ? ASK_DIALOG : CFG.LAYOUT.cutDialog;
      const full = st.say.text;
      const chars = Math.floor((now - st.say.t0) * CFG.TYPE_SPEED);
      if (chars > (st.say.ticked || 0) && chars < full.length) { if (chars % 2 === 0) Sound.sfx('type'); st.say.ticked = chars; } // 글자 나오는 소리
      let left = chars;
      const lines = UI.wrap(full, L.w - 60, 26).map((s) => { const part = s.slice(0, Math.max(0, left)); left -= s.length; return part; });
      UI.dialog(L, st.say.tag, lines, chars >= full.length && st.block !== 'input', now, st.say.color);
    }
    ctx.restore();

    // 가게 이름 입력: 확정 버튼과 오류 문구(HTML 입력칸은 대사창 위에 겹쳐 놓인다)
    if (st.block === 'input' && st.phase === 'run') {
      ctx.save();
      ctx.translate(OX, 0);
      if (st.inputErr) UI.text(st.inputErr, 900, ASK_DIALOG.y + 28, 18, C.alert, 'right');
      UI.button(INPUT_OK, '확정', { style: 'primary', onClick: () => submit(now) });
      ctx.restore();
    }

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
      UI.text(st.title.main, 480, 292, 52, C.white, 'center', C.ink, CFG.TITLE_OUTLINE);
      UI.rect(430, 334, 100, 4, C.yellow);
      ctx.restore();
    }

    // 장면 전환 페이드
    let fade = 0;
    if (st.phase === 'in') fade = 1 - Math.min(1, (now - st.pt) / FADE);
    else if (st.phase === 'out') fade = Math.min(1, (now - st.pt) / FADE);
    if (fade > 0) { ctx.fillStyle = 'rgba(8,20,34,' + fade + ')'; ctx.fillRect(0, 0, W, H); }
  }

  return { start, draw, advance, submit, skip, active: () => !!st,
    art: { outlinedImg, drawFacing, ME_FRONT, ME_BACK, ME_WALK, ME_PAL, NPC_PALS, // 가게 화면(game.js)이 같은 인물 도트를 쓴다
      street: { build: buildStreetBg, shop: drawStreetShop, LW, GH, EXT } } }; // 하루의 시작·끝 장면(exterior.js)
})();
