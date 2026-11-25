// 가게 바닥 그리기(3/4 탑다운)와 배치 규칙. 계산(돈·손님)은 하지 않는다. 좌표는 가운데 960 영역 기준.
// 놓는 것(thing): 기계 / 설비(쓰레기통·자동환전기·로봇 청소기) / 소품(바닥·벽). 위치 pos = {x, y} 격자 칸, 벽은 y = -1.
// 회전 rot = 0~3(앞면이 아래·왼쪽·위·오른쪽). 기계는 앞면 쪽 칸이 손님이 서는 자리다. 벽 오른쪽 끝 칸에는 창고 문이 있다.
const ShopView = (function () {
  const C = CFG.COLOR;
  const CW = 56, CH = 60;                                  // 격자 한 칸
  const GRIDS = [[6, 4], [8, 4], [10, 5], [12, 5]];        // 점포 단계별 [가로, 세로] 칸
  const AREA = { x: 20, y: 70, w: 690, h: 420 };           // 가게가 놓이는 영역
  const WALL = 70;
  const TASTE_COLOR = { 동물: '#c98d58', 귀여움: '#ff9fbc', 음식: '#ffb347', 코믹: '#7ccf6a', 우주: '#7a8cf0', 레트로: '#b59a6a', 희귀: '#ffd84a', 아이돌: '#c58bf0' };
  const CABINET = { mini: ['#7fd0c4', '#4fae9f'], standard: ['#4590e0', '#2c6cb8'], big: ['#8a7be0', '#5f50b8'], timer: ['#f0a13c', '#c0761a'] };

  function geom(level) {
    const [cols, rows] = GRIDS[level];
    const w = cols * CW, h = rows * CH;
    const x = Math.round(AREA.x + (AREA.w - w) / 2);
    const y = Math.round(AREA.y + WALL + (AREA.h - WALL - h) / 2);
    return { cols, rows, x, y, w, h, door: { x: cols - 1, y: rows - 1 }, store: { x: x + (cols - 1) * CW + 6, y: y - 62, w: CW - 12, h: 50 } };
  }

  // ---------- 놓는 것 목록 ----------
  const machineThing = (m) => ({ key: 'm' + m.id, kind: 'machine', ref: m, holder: m, w: DATA.MACHINES[m.type].footprint });
  const binThing = (b) => ({ key: 'b' + b.uid, kind: 'bin', ref: b, holder: b, w: 1 });
  const decorThing = (o) => { const d = Sim.decorDef(o.id); return d && { key: 'd' + o.uid, kind: 'decor', ref: o, holder: o, w: d.width, wall: !!d.wall, def: d }; };
  const fixThing = (st, k) => ({ key: 'f' + k, kind: 'fix', ref: k, holder: st.fix[k], w: 1 });
  // 모든 설치물(설치한 것 + 창고에 넣은 것)
  function everything(st) {
    st.fix = st.fix || {};
    const fix = ['exchanger', 'robot'].filter((k) => st.equip[k]);
    fix.forEach((k) => { st.fix[k] = st.fix[k] || { pos: null }; });
    return st.machines.map(machineThing).concat(st.bins.map(binThing), fix.map((k) => fixThing(st, k)), st.decors.map(decorThing).filter(Boolean));
  }
  const stored = (st) => everything(st).filter((t) => t.holder.stored);
  function things(st) { return everything(st).filter((t) => !t.holder.stored); }
  // ---------- 배치 규칙 ----------
  // 회전: 기계와 바닥 소품만. 옆으로 돌리면 가로 칸이 세로 칸이 된다.
  const canRotate = (t) => !t.wall && (t.kind === 'machine' || t.kind === 'decor');
  const rotOf = (t) => (canRotate(t) ? (t.holder.rot || 0) : 0);
  const dims = (t) => (rotOf(t) % 2 ? { w: 1, h: t.w } : { w: t.w, h: 1 });
  function cells(t, p) {
    const d = dims(t), out = [];
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) out.push({ x: p.x + x, y: p.y + y });
    return out;
  }
  // 기계 앞면에 닿는 칸들(손님이 서는 자리)
  function frontOf(t, p) {
    p = p || t.holder.pos;
    const d = dims(t), r = rotOf(t), n = r % 2 ? d.h : d.w;
    return Array.from({ length: n }, (_, i) => (r === 0 ? { x: p.x + i, y: p.y + d.h } : r === 2 ? { x: p.x + i, y: p.y - 1 }
      : r === 1 ? { x: p.x - 1, y: p.y + i } : { x: p.x + d.w, y: p.y + i }));
  }
  const k = (x, y) => x + ',' + y;
  // others(이미 놓인 것)와 함께 (x, y)에 놓을 수 있는지
  function fits(st, t, x, y, others) {
    const g = geom(st.shopLevel);
    if (t.wall) {
      if (y !== -1 || x < 0 || x + t.w > g.cols - 1) return false;
      return others.every((o) => !o.wall || !o.holder.pos || x + t.w <= o.holder.pos.x || o.holder.pos.x + o.w <= x);
    }
    const d = dims(t);
    if (x < 0 || y < 0 || x + d.w > g.cols || y + d.h > g.rows) return false;
    const solid = new Set(), front = new Set();
    const add = (o, p) => { cells(o, p).forEach((c) => solid.add(k(c.x, c.y))); if (o.kind === 'machine') frontOf(o, p).forEach((c) => front.add(k(c.x, c.y))); };
    others.forEach((o) => { if (!o.wall && o.holder.pos) add(o, o.holder.pos); });
    const door = k(g.door.x, g.door.y);
    for (const c of cells(t, { x, y })) if (solid.has(k(c.x, c.y)) || front.has(k(c.x, c.y)) || k(c.x, c.y) === door) return false;
    if (t.kind === 'machine') for (const c of frontOf(t, { x, y })) {
      if (c.x < 0 || c.y < 0 || c.x >= g.cols || c.y >= g.rows || solid.has(k(c.x, c.y)) || k(c.x, c.y) === door) return false;
    }
    add(t, { x, y });
    if (solid.has(door)) return false;
    // 입구에서 모든 기계 앞과 쓰레기통까지 걸어갈 수 있어야 한다
    const seen = new Set([door]), queue = [[g.door.x, g.door.y]];
    while (queue.length) {
      const [cx, cy] = queue.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy, key = k(nx, ny);
        if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows || seen.has(key) || solid.has(key)) return;
        seen.add(key); queue.push([nx, ny]);
      });
    }
    if ([...front].some((f) => !seen.has(f))) return false;
    return others.concat([Object.assign({}, t, { holder: { pos: { x, y } } })]).every((o) => {
      if (o.kind !== 'bin' || !o.holder.pos) return true;
      const p = o.holder.pos;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(k(p.x + dx, p.y + dy)));
    });
  }
  function canPlace(st, t, x, y) { return fits(st, t, x, y, things(st).filter((o) => o.key !== t.key)); }
  function findSpot(st, t, others) {
    const g = geom(st.shopLevel);
    if (t.wall) { for (let x = 0; x < g.cols; x++) if (fits(st, t, x, -1, others)) return { x, y: -1 }; return null; }
    const ys = Array.from({ length: g.rows }, (_, i) => (t.kind === 'machine' ? i : g.rows - 1 - i)); // 기계는 위쪽부터, 나머지는 아래쪽부터
    for (const y of ys) for (let x = 0; x < g.cols; x++) if (fits(st, t, x, y, others)) return { x, y };
    return null;
  }
  // 설치한 것 가운데 자리가 없거나 규칙에 어긋난 것을 빈 곳에 놓는다. 놓을 곳이 없으면 창고로 보낸다.
  function autoPlace(st) {
    const rank = (t) => (t.kind === 'machine' ? 0 : t.kind === 'fix' ? 1 : t.kind === 'bin' ? 2 : 3);
    const done = [], later = [];
    things(st).sort((a, b) => rank(a) - rank(b)).forEach((t) => { const p = t.holder.pos; if (p && fits(st, t, p.x, p.y, done)) done.push(t); else later.push(t); });
    later.forEach((t) => {
      t.holder.pos = null;
      const p = findSpot(st, t, done);
      if (p) { t.holder.pos = p; done.push(t); return; }
      if (t.kind === 'machine') Sim.storeMachine(st, t.ref.id); else t.holder.stored = true;
    });
  }

  // ---------- 화면 좌표 ----------
  function rectOf(g, t, pos) {
    pos = pos || t.holder.pos;
    const x = g.x + pos.x * CW, y = g.y + pos.y * CH, d = dims(t);
    if (t.wall) return { x: x + 4, y: g.y - 56, w: t.w * CW - 8, h: 30 };
    if (t.kind === 'machine') return { x: x + 3, y: y - 26, w: d.w * CW - 6, h: d.h * CH + 22 };
    if (t.kind === 'fix' || t.kind === 'bin') return { x: x + 8, y: y + 4, w: CW - 16, h: CH - 12 };
    return { x: x + 4, y: y - 12, w: d.w * CW - 8, h: d.h * CH + 6 };
  }
  function standPoint(g, m) { // 기계 앞에 서는 발 위치
    const f = frontOf(machineThing(m)), c = f[Math.floor((f.length - 1) / 2)];
    return { x: g.x + (c.x + 0.5) * CW, y: g.y + (c.y + 1) * CH - 10 };
  }
  const doorPoint = (g) => ({ x: g.x + (g.door.x + 0.5) * CW, y: g.y + g.h - 4 });

  // ---------- 그리기 ----------
  function room(st, opts) {
    const g = geom(st.shopLevel);
    // 벽
    UI.rect(g.x - 8, g.y - WALL - 4, g.w + 16, g.h + WALL + 12, C.ink);
    UI.rect(g.x - 4, g.y - WALL, g.w + 8, WALL, '#dcebf7');
    UI.rect(g.x - 4, g.y - 12, g.w + 8, 12, '#b8d2e8');
    for (let i = 0; i * 28 < g.w + 8; i++) UI.rect(g.x - 4 + i * 28, g.y - WALL, Math.min(14, g.w + 8 - i * 28), 10, i % 2 ? '#6ab0f0' : C.blue);
    // 창고 문
    const s = g.store;
    UI.framed(s, '#c79a6a', 2);
    UI.rect(s.x + 3, s.y + 14, s.w - 6, 3, '#a87a4a'); UI.rect(s.x + s.w - 10, s.y + 28, 4, 8, C.ink);
    UI.text('창고', s.x + s.w / 2, s.y + 8, 14, C.white);
    // 바닥
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const px = g.x + x * CW, py = g.y + y * CH;
      UI.rect(px, py, CW, CH, (x + y) % 2 ? '#eef3f8' : '#e1eaf2');
      if (opts && opts.grid) { UI.rect(px, py, CW, 1, '#a9c0d4'); UI.rect(px, py, 1, CH, '#a9c0d4'); }
    }
    // 입구
    const dx = g.x + g.door.x * CW, dy = g.y + g.door.y * CH;
    UI.rect(dx + 4, dy + CH - 10, CW - 8, 14, '#8a6a4a');
    UI.text('입구', dx + CW / 2, dy + CH - 20, 14, C.sub);
  }

  function dollIcon(x, y, d, s) {
    const c = TASTE_COLOR[d.taste[0]] || '#ffffff';
    UI.rect(x, y + 2 * s, 7 * s, 5 * s, c);
    UI.rect(x, y, 2 * s, 2 * s, c); UI.rect(x + 5 * s, y, 2 * s, 2 * s, c);
    UI.rect(x + 2 * s, y + 3 * s, s, s, C.ink); UI.rect(x + 4 * s, y + 3 * s, s, s, C.ink);
  }

  // 유리 안의 인형(많을수록 많이 보인다)
  function inside(m, glass, rows) {
    const items = [];
    Object.keys(m.load).forEach((id) => { for (let i = 0; i < m.load[id].qty; i++) items.push(Sim.info.doll(id)); });
    if (DATA.MACHINES[m.type].kind === 'timer') {
      const s = Math.min(glass.w < 34 ? 3 : 4, Math.floor((glass.h - 1) / 7));
      if (items.length) dollIcon(glass.x + glass.w / 2 - 3.5 * s, glass.y + glass.h - 7 * s - 1, items[0], s);
    } else {
      const per = Math.max(1, Math.floor((glass.w - 2) / 11)), show = Math.min(items.length, per * rows);
      for (let i = 0; i < show; i++) {
        const d = items[Math.floor(i * items.length / show)], row = Math.floor(i / per);
        dollIcon(glass.x + 2 + (i % per) * 11 + (per > 1 ? (row % 2) * 3 : 0), glass.y + glass.h - 12 - row * 9, d, d.size === 'L' && per > 1 ? 2 : 1.5);
      }
      UI.rect(glass.x + glass.w / 2 - 1, glass.y, 2, 8, '#44505c'); UI.rect(glass.x + glass.w / 2 - 4, glass.y + 8, 8, 3, '#44505c'); // 집게
    }
    return items.length;
  }
  // 기계 하나. o: {down}. 회전 0 앞 / 1 왼쪽 / 2 뒤 / 3 오른쪽
  // 네 방향 모두 같은 몸통이다: 윗면(지붕) 아래에 높이 72의 옆면 = 간판 12 · 유리 33 · 조종대 9 · 받침 13 · 다리 4.
  // 옆으로 돌린 대형 기계는 안쪽으로 긴 만큼 지붕이 길게 보인다.
  const FACE = 72;
  const SHADE = 'rgba(10,30,50,0.28)', SHINE = 'rgba(255,255,255,0.55)';
  const feet = (x, w, y) => { UI.rect(x + 2, y, 7, 4, C.ink); UI.rect(x + w - 9, y, 7, 4, C.ink); };
  function glassBox(m, g, o, rows) {
    UI.framed(g, o.down ? '#8b98a5' : '#d8f1ff', 2);
    UI.rect(g.x, g.y, g.w, 3, '#aac4d8'); // 집게가 다니는 레일
    const n = inside(m, g, rows);
    for (let i = 0; i < 9; i++) UI.rect(g.x + 11 - i, g.y + 5 + i, 2, 1, SHINE); // 유리 반사
    return n;
  }
  function roofTop(x, y, w, roof, col) {
    UI.rect(x, y, w, roof, col[0]);
    UI.rect(x + 3, y + 2, w - 6, 3, SHINE);
    UI.rect(x, y + roof - 1, w, 1, C.ink);
  }
  function front(m, x, y, w, h, o, col, timer) {
    const roof = h - FACE, f = y + roof;
    UI.framed({ x, y, w, h: h - 4 }, col[1], 2);
    feet(x, w, y + h - 4);
    roofTop(x, y, w, roof, col);
    // 간판(불 켜진 상자)
    UI.rect(x, f, w, 12, col[0]);
    UI.rect(x + 3, f + 1, w - 6, 10, timer ? C.ink : '#ffffff');
    if (timer) UI.text('10.00', x + w / 2, f + 6, 14, '#ffd84a');
    else for (let i = 0; i * 9 + 11 <= w - 6; i++) UI.rect(x + 7 + i * 9, f + 4, 4, 4, i % 2 ? col[0] : '#ffb300');
    const count = glassBox(m, { x: x + 4, y: f + 14, w: w - 8, h: 31 }, o, 3);
    // 앞으로 튀어나온 조종대: 밝은 윗면 + 앞 모서리
    UI.framed({ x: x - 2, y: f + 48, w: w + 4, h: 7 }, col[0], 1);
    UI.rect(x - 2, f + 48, w + 4, 3, '#e4eff8');
    if (timer) { UI.framed({ x: x + w / 2 - 7, y: f + 45, w: 14, h: 5 }, '#d9455f', 1); }
    else {
      const jx = x + Math.round(w * 0.26);
      UI.rect(jx, f + 43, 2, 7, C.ink); UI.framed({ x: jx - 2, y: f + 40, w: 6, h: 5 }, '#d9455f', 1);
      UI.framed({ x: x + Math.round(w * 0.64), y: f + 47, w: 6, h: 3 }, '#ffd84a', 1);
      if (w > 60) UI.framed({ x: x + Math.round(w * 0.78), y: f + 47, w: 6, h: 3 }, '#7ccf6a', 1);
    }
    // 받침: 동전 투입구와 경품 나오는 문
    UI.framed({ x: x + 6, y: f + 58, w: 7, h: 8 }, '#c9d9e6', 1); UI.rect(x + 9, f + 60, 1, 4, C.ink);
    const dw = Math.min(30, Math.round(w * 0.42)), dx = x + w - dw - 5;
    UI.framed({ x: dx, y: f + 58, w: dw, h: 9 }, '#14324d', 1); UI.rect(dx + 2, f + 59, dw - 4, 3, '#5f7a92');
    return count;
  }
  function back(m, x, y, w, h, o, col) {
    const roof = h - FACE, f = y + roof;
    UI.framed({ x, y, w, h: h - 4 }, col[1], 2);
    feet(x, w, y + h - 4);
    roofTop(x, y, w, roof, col);
    UI.rect(x, f, w, 12, col[0]); // 간판 뒷판(나사)
    [x + 4, x + w - 7].forEach((sx) => UI.rect(sx, f + 4, 3, 3, C.ink));
    const count = glassBox(m, { x: x + 7, y: f + 14, w: w - 14, h: 23 }, o, 2);
    UI.rect(x, f + 40, w, FACE - 44, col[1]);
    UI.rect(x, f + 40, w, 2, C.ink);
    // 점검문(자물쇠, 통풍구)과 바닥으로 내려가는 전선
    UI.framed({ x: x + 6, y: f + 45, w: w - 18, h: 19 }, col[0], 1);
    for (let i = 0; i < 3; i++) UI.rect(x + 11, f + 49 + i * 5, w - 34, 2, C.ink);
    UI.rect(x + w - 19, f + 53, 3, 4, '#ffd84a');
    UI.rect(x + w - 7, f + 55, 2, 13, C.ink); UI.rect(x + w - 7, f + 68, 10, 2, C.ink);
    UI.rect(x, y, w, h - 4, 'rgba(10,30,50,0.08)');
    return count;
  }
  // 왼쪽을 보는 옆모습(오른쪽을 보면 좌우를 뒤집는다). 조종대가 앞(왼쪽)으로 비스듬히 튀어나온다.
  function side(m, x, y, w, h, o, col) {
    const roof = h - FACE, f = y + roof, bx = x + 8, bw = w - 8;
    UI.framed({ x: bx, y, w: bw, h: h - 4 }, col[1], 2);
    feet(bx, bw, y + h - 4);
    roofTop(bx, y, bw, roof, col);
    if (roof > 20) { // 긴 지붕: 덮개와 통풍구
      UI.framed({ x: bx + 8, y: y + 10, w: bw - 16, h: roof - 24 }, col[0], 1);
      UI.rect(bx + 8, y + 10, bw - 16, 3, SHINE);
      for (let i = 0; i < 4; i++) UI.rect(bx + 13, y + roof - 36 + i * 5, bw - 26, 2, col[1]);
    }
    UI.rect(bx, y + 1, 4, roof - 2, '#ffffff'); // 앞쪽 지붕 모서리의 조명 띠
    for (let i = 6; i < roof - 4; i += 9) UI.rect(bx + 1, y + i, 2, 3, '#ffb300');
    // 간판 옆면: 앞으로 살짝 튀어나온 조명 상자
    UI.rect(bx, f, bw, 12, col[0]);
    UI.framed({ x: bx - 2, y: f + 2, w: bw - 2, h: 8 }, '#ffffff', 1);
    for (let i = 3; i + 4 <= bw - 4; i += 9) UI.rect(bx + i, f + 4, 4, 4, (i / 9) % 2 < 1 ? '#ffb300' : col[0]);
    const count = glassBox(m, { x: bx + 4, y: f + 14, w: bw - 9, h: 31 }, o, 3);
    // 조종대 옆모습(아래로 갈수록 앞으로 나온 경사)과 조종간
    for (let i = 0; i < 10; i++) {
      const p = Math.min(8, 2 + i);
      UI.rect(bx - p - 1, f + 46 + i, p + 1, 1, C.ink);
      UI.rect(bx - p, f + 46 + i, p, 1, i < 3 || i === 9 ? (i === 9 ? C.ink : '#e4eff8') : col[0]);
    }
    if (DATA.MACHINES[m.type].kind === 'timer') UI.framed({ x: bx - 6, y: f + 42, w: 7, h: 4 }, '#d9455f', 1);
    else { UI.rect(bx - 5, f + 40, 2, 8, C.ink); UI.framed({ x: bx - 7, y: f + 37, w: 5, h: 4 }, '#d9455f', 1); }
    // 받침 옆면: 장식 띠와 통풍구, 뒤쪽 그늘
    UI.rect(bx, f + 59, bw, 2, col[0]);
    for (let i = 0; i < 3; i++) UI.rect(bx + bw - 20 + i * 5, f + 63, 2, 4, C.ink);
    UI.rect(bx + bw - 4, y, 4, h - 4, SHADE);
    UI.rect(bx, y + roof, 2, FACE - 4, SHINE);
    return count;
  }
  function machine(m, r, o) {
    const def = DATA.MACHINES[m.type], col = CABINET[m.type], rot = m.rot || 0, timer = def.kind === 'timer';
    const x = r.x, y = r.y, w = r.w, h = r.h;
    UI.rect(x + 4, y + h - 4, w, 8, 'rgba(20,50,77,0.25)');
    let count = 0;
    if (rot === 0) count = front(m, x, y, w, h, o, col, timer);
    else if (rot === 2) count = back(m, x, y, w, h, o, col);
    else if (rot === 1) count = side(m, x, y, w, h, o, col);
    else UI.mirror(x + w / 2, () => { count = side(m, x, y, w, h, o, col); });
    const tx = x + w / 2 + (rot === 1 ? 4 : rot === 3 ? -4 : 0);
    if (!count) UI.text(w < 56 ? '빔' : '비었음', tx, y + h - FACE + (rot === 2 ? 26 : 30), 14, C.alert);
    if (m.mods.durable) UI.rect(x + (rot === 1 ? 11 : 3), y + h - 12, 5, 5, '#ffffff');
  }

  function bin(big, r) {
    const { x, y, w, h } = r, bw = big ? 34 : 22, bh = big ? 36 : 28;
    const b = { x: x + (w - bw) / 2, y: y + h - bh, w: bw, h: bh };
    UI.framed(b, big ? '#3f9a5a' : '#7d8b99', 2);
    UI.rect(b.x - 2, b.y, b.w + 4, 6, C.ink);
    UI.rect(b.x + bw / 2 - 5, b.y + 12, 10, 10, '#ffffff');
  }
  function fixture(st, key, r) {
    const { x, y, w, h } = r;
    if (key === 'exchanger') {
      UI.framed({ x: x + 4, y: y + 2, w: w - 8, h: h - 4 }, '#2aa198', 2);
      UI.rect(x + 4, y + 2, w - 8, 10, '#4cc4ba');
      UI.rect(x + 10, y + 18, w - 20, 8, C.ink);
      UI.coin(x + w / 2 - 8, y + h - 22, 2);
    } else {
      UI.framed({ x: x + 4, y: y + h - 22, w: w - 8, h: 16 }, '#e4eff8', 2);
      UI.rect(x + w / 2 - 3, y + h - 18, 6, 6, '#2f80d0');
      UI.rect(x + 6, y + h - 34, 6, 12, '#7d8b99');
    }
  }

  // 소품 그림(바닥·벽)
  const ART = {
    plant: (r, cx, b) => { UI.framed({ x: cx - 11, y: b - 20, w: 22, h: 18 }, '#c97a4a', 2); [[-14, -38, 16, 16], [0, -42, 14, 18], [-6, -50, 12, 14]].forEach((a) => UI.rect(cx + a[0], b + a[1], a[2], a[3], '#3f9a5a')); UI.rect(cx - 2, b - 30, 4, 12, '#2c7a44'); },
    trophy: (r, cx, b) => { UI.framed({ x: cx - 14, y: b - 14, w: 28, h: 12 }, '#8a6a4a', 2); UI.rect(cx - 3, b - 26, 6, 12, '#f2c14e'); UI.framed({ x: cx - 10, y: b - 44, w: 20, h: 18 }, '#ffd84a', 2); },
    bench: (r, cx, b) => { UI.framed({ x: r.x + 6, y: b - 34, w: r.w - 12, h: 10 }, '#c79a6a', 2); UI.framed({ x: r.x + 4, y: b - 20, w: r.w - 8, h: 10 }, '#e0b988', 2); UI.rect(r.x + 10, b - 8, 6, 8, C.ink); UI.rect(r.x + r.w - 16, b - 8, 6, 8, C.ink); },
    photozone: (r, cx, b) => { UI.framed({ x: r.x + 6, y: r.y + 4, w: r.w - 12, h: r.h - 12 }, '#ffd6e4', 3); UI.framed({ x: r.x + 16, y: r.y + 14, w: r.w - 32, h: r.h - 34 }, '#d8f1ff', 2); dollIcon(cx - 14, b - 42, { taste: ['귀여움'] }, 4); },
    aquarium: (r, cx, b) => { UI.framed({ x: r.x + 6, y: b - 46, w: r.w - 12, h: 36 }, '#5cc0e8', 2); UI.rect(r.x + 4, b - 10, r.w - 8, 10, C.ink); [[16, -34, '#ffb347'], [50, -22, '#ff9fbc'], [76, -38, '#ffd84a']].forEach((f) => { UI.rect(r.x + f[0], b + f[1], 10, 6, f[2]); UI.rect(r.x + f[0] - 4, b + f[1] + 1, 4, 4, f[2]); }); },
    mascot: (r, cx, b) => { UI.framed({ x: cx - 32, y: b - 10, w: 64, h: 8 }, '#7d8b99', 2); dollIcon(cx - 28, b - 66, { taste: ['아이돌'] }, 8); },
    goldstatue: (r, cx, b) => { UI.framed({ x: cx - 30, y: b - 16, w: 60, h: 14 }, '#8a5a1a', 2); dollIcon(cx - 25, b - 66, { taste: ['희귀'] }, 7); UI.rect(cx + 20, b - 68, 4, 12, '#ffffff'); UI.rect(cx + 16, b - 64, 12, 4, '#ffffff'); },
    arcadeset: (r, cx, b) => { UI.framed({ x: cx - 17, y: b - 52, w: 34, h: 50 }, '#d9455f', 2); UI.framed({ x: cx - 11, y: b - 46, w: 22, h: 18 }, '#14324d', 2); UI.rect(cx - 5, b - 40, 8, 6, '#7ccf6a'); UI.rect(cx - 10, b - 18, 6, 6, '#ffd84a'); UI.rect(cx + 4, b - 18, 6, 6, '#ffffff'); },
    crown: (r, cx, b) => { UI.framed({ x: cx - 18, y: b - 20, w: 36, h: 18 }, '#5f50b8', 2); UI.framed({ x: cx - 14, y: b - 38, w: 28, h: 14 }, '#ffd84a', 2); [-14, -3, 8].forEach((d) => UI.rect(cx + d, b - 48, 6, 10, '#ffd84a')); },
    poster: (r) => { UI.framed({ x: r.x + 10, y: r.y - 2, w: r.w - 20, h: r.h + 2 }, '#ffffff', 2); dollIcon(r.x + r.w / 2 - 7, r.y + 7, { taste: ['귀여움'] }, 2); },
    neon: (r, cx) => { UI.framed(r, '#14324d', 2); UI.text('뽑기!', cx, r.y + r.h / 2, 14, '#ff9fbc'); },
    ledboard: (r, cx) => { UI.framed(r, '#14324d', 3); for (let i = 0; i < Math.floor(r.w / 12) - 1; i++) UI.rect(r.x + 8 + i * 12, r.y + 3, 5, 3, ['#ffd84a', '#7ccf6a', '#ff9fbc'][i % 3]); UI.text('ARENA LIVE', cx, r.y + r.h / 2 + 3, 14, '#6ab0f0'); },
    goldframe: (r) => { UI.framed({ x: r.x + 10, y: r.y, w: r.w - 20, h: r.h - 2 }, '#ffd84a', 2); UI.rect(r.x + 15, r.y + 5, r.w - 30, r.h - 12, '#d8f1ff'); },
  };
  // 인형 조형물(마스코트·황금상)의 방향: 뒤를 보면 얼굴이 없고, 옆이면 눈이 한쪽
  function figure(x, y, s, color, rot) {
    dollIcon(x, y, { taste: [color] }, s);
    if (!rot) return;
    const body = TASTE_COLOR[color];
    UI.rect(x + 2 * s, y + 3 * s, 3 * s, s, body);
    if (rot !== 2) UI.rect(x + (rot === 1 ? 1 : 5) * s, y + 3 * s, s, s, C.ink);
  }
  // 옆·뒤로 돌린 모양(없는 것은 좌우를 뒤집어 그린다)
  const TURNED = {
    bench: (r, cx, b, rot) => {
      if (rot === 2) { UI.framed({ x: r.x + 4, y: b - 30, w: r.w - 8, h: 10 }, '#e0b988', 2); UI.framed({ x: r.x + 6, y: b - 18, w: r.w - 12, h: 14 }, '#c79a6a', 2); return; }
      const back = rot === 1 ? r.x + r.w - 16 : r.x + 6;
      UI.framed({ x: r.x + 10, y: r.y + 20, w: r.w - 20, h: r.h - 30 }, '#e0b988', 2);
      UI.framed({ x: back, y: r.y + 8, w: 10, h: r.h - 24 }, '#c79a6a', 2);
      UI.rect(r.x + 12, b - 8, 6, 8, C.ink); UI.rect(r.x + r.w - 18, b - 8, 6, 8, C.ink);
    },
    photozone: (r, cx, b, rot) => {
      if (rot === 2) { UI.framed({ x: r.x + 6, y: r.y + 4, w: r.w - 12, h: r.h - 12 }, '#d9a8b8', 3); UI.rect(cx - 2, r.y + 8, 4, r.h - 20, '#b8869a'); return; }
      const board = rot === 1 ? r.x + r.w - 18 : r.x + 6;
      UI.framed({ x: board, y: r.y + 4, w: 12, h: r.h - 12 }, '#ffd6e4', 3);
      figure(cx - 14, b - 40, 4, '귀여움', rot);
    },
    aquarium: (r, cx, b, rot) => {
      if (rot === 2) { UI.mirror(cx, () => ART.aquarium(r, cx, b)); return; }
      UI.framed({ x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 22 }, '#5cc0e8', 2);
      UI.rect(r.x + 8, b - 10, r.w - 16, 10, C.ink);
      [[18, 26, '#ffb347'], [14, 50, '#ff9fbc'], [22, 74, '#ffd84a']].forEach((f) => { UI.rect(r.x + f[0], r.y + f[1], 10, 6, f[2]); UI.rect(r.x + f[0] + (rot === 1 ? 10 : -4), r.y + f[1] + 1, 4, 4, f[2]); });
    },
    mascot: (r, cx, b, rot) => { UI.framed({ x: r.x + 6, y: b - 10, w: r.w - 12, h: 8 }, '#7d8b99', 2); figure(cx - (rot % 2 ? 21 : 28), b - (rot % 2 ? 52 : 66), rot % 2 ? 6 : 8, '아이돌', rot); },
    goldstatue: (r, cx, b, rot) => { UI.framed({ x: r.x + 6, y: b - 16, w: r.w - 12, h: 14 }, '#8a5a1a', 2); figure(cx - (rot % 2 ? 21 : 25), b - (rot % 2 ? 58 : 66), rot % 2 ? 6 : 7, '희귀', rot); },
    arcadeset: (r, cx, b, rot) => {
      if (rot === 2) { UI.framed({ x: cx - 17, y: b - 52, w: 34, h: 50 }, '#a52c43', 2); for (let i = 0; i < 3; i++) UI.rect(cx - 10, b - 40 + i * 8, 20, 3, '#d9455f'); return; }
      const side = rot === 1 ? -1 : 1;
      UI.framed({ x: cx - 12, y: b - 52, w: 24, h: 50 }, '#d9455f', 2);
      UI.framed({ x: cx + side * 12 - 5, y: b - 46, w: 10, h: 18 }, '#14324d', 2);
      UI.rect(cx + side * 14 - 4, b - 22, 8, 6, '#ffd84a');
    },
    trophy: (r, cx, b, rot) => { if (rot === 2) ART.trophy(r, cx, b); else UI.mirror(cx, () => ART.trophy(r, cx, b)); },
  };
  function decor(id, r, rot) {
    const draw = ART[id], cx = r.x + r.w / 2, b = r.y + r.h - 2;
    const wall = Sim.decorDef(id).wall;
    if (!wall) UI.rect(r.x + 6, b - 2, r.w - 8, 6, 'rgba(20,50,77,0.2)');
    if (rot && TURNED[id]) TURNED[id](r, cx, b, rot);
    else if (rot && draw) UI.mirror(cx, () => draw(r, cx, b));
    else if (draw) draw(r, cx, b);
    else UI.framed({ x: r.x + 6, y: r.y + 10, w: r.w - 12, h: r.h - 16 }, '#c9d9e6', 2);
  }

  // 놓는 것 하나를 r에 그린다. o: {selected, down, ghost('ok'|'no')}
  function thing(st, t, r, o) {
    o = o || {};
    if (t.kind === 'machine') machine(t.ref, r, o);
    else if (t.kind === 'fix') fixture(st, t.ref, r);
    else if (t.kind === 'bin') bin(t.ref.big, r);
    else decor(t.ref.id, r, rotOf(t));
    const x = r.x, y = r.y, w = r.w, h = r.h;
    if (o.selected) [[x - 5, y - 5, w + 10, 3], [x - 5, y + h + 2, w + 10, 3], [x - 5, y - 5, 3, h + 10], [x + w + 2, y - 5, 3, h + 10]].forEach((a) => UI.rect(a[0], a[1], a[2], a[3], '#ffb300'));
    if (o.ghost) UI.rect(x - 2, y - 2, w + 4, h + 4, o.ghost === 'ok' ? 'rgba(60,200,110,0.35)' : 'rgba(217,69,95,0.45)');
  }
  // 앞뒤 순서: 아래 줄에 있는 것이 앞
  const depth = (g, t) => (t.wall ? -1000 : g.y + (t.holder.pos.y + dims(t).h) * CH);

  return { CW, CH, geom, canRotate, rotOf, dims, cells, frontOf, machineThing, things, stored, canPlace, autoPlace, rectOf, depth, standPoint, doorPoint, room, thing, dollIcon, TASTE_COLOR };
})();
