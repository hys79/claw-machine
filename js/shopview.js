// 가게 바닥 그리기(3/4 탑다운)와 배치 규칙. 계산(돈·손님)은 하지 않는다. 좌표는 가운데 960 영역 기준.
// 놓는 것(thing): 기계 / 설비(환전대·쓰레기통·로봇 청소기) / 소품(바닥·벽). 위치 pos = {x, y} 격자 칸, 벽은 y = -1.
// 기계는 바로 아래 칸이 손님이 서는 자리다. 벽 오른쪽 끝 칸에는 창고 문이 있다.
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
  const FIX_NAME = { exchange: '환전대', robot: '로봇 청소기' };
  const machineThing = (m) => ({ key: 'm' + m.id, kind: 'machine', ref: m, holder: m, w: DATA.MACHINES[m.type].footprint });
  const binThing = (b) => ({ key: 'b' + b.uid, kind: 'bin', ref: b, holder: b, w: 1 });
  const decorThing = (o) => { const d = Sim.decorDef(o.id); return d && { key: 'd' + o.uid, kind: 'decor', ref: o, holder: o, w: d.width, wall: !!d.wall, def: d }; };
  const fixThing = (st, k) => ({ key: 'f' + k, kind: 'fix', ref: k, holder: st.fix[k], w: 1 });
  // 모든 설치물(설치한 것 + 창고에 넣은 것). 환전대는 가게에 붙박이다.
  function everything(st) {
    st.fix = st.fix || {};
    const fix = ['exchange'].concat(st.equip.robot ? ['robot'] : []);
    fix.forEach((k) => { st.fix[k] = st.fix[k] || { pos: null }; });
    return st.machines.map(machineThing).concat(st.bins.map(binThing), fix.map((k) => fixThing(st, k)), st.decors.map(decorThing).filter(Boolean));
  }
  const stored = (st) => everything(st).filter((t) => t.holder.stored);
  function things(st) { return everything(st).filter((t) => !t.holder.stored); }
  // ---------- 배치 규칙 ----------
  const cells = (t, p) => Array.from({ length: t.w }, (_, i) => ({ x: p.x + i, y: p.y }));
  const k = (x, y) => x + ',' + y;
  // others(이미 놓인 것)와 함께 (x, y)에 놓을 수 있는지
  function fits(st, t, x, y, others) {
    const g = geom(st.shopLevel);
    if (t.wall) {
      if (y !== -1 || x < 0 || x + t.w > g.cols - 1) return false;
      return others.every((o) => !o.wall || !o.holder.pos || x + t.w <= o.holder.pos.x || o.holder.pos.x + o.w <= x);
    }
    const maxY = t.kind === 'machine' ? g.rows - 2 : g.rows - 1;
    if (x < 0 || y < 0 || x + t.w > g.cols || y > maxY) return false;
    const solid = new Set(), front = new Set();
    const add = (o, p) => cells(o, p).forEach((c) => { solid.add(k(c.x, c.y)); if (o.kind === 'machine') front.add(k(c.x, c.y + 1)); });
    others.forEach((o) => { if (!o.wall && o.holder.pos) add(o, o.holder.pos); });
    const door = k(g.door.x, g.door.y);
    for (const c of cells(t, { x, y })) {
      if (solid.has(k(c.x, c.y)) || front.has(k(c.x, c.y)) || k(c.x, c.y) === door) return false;
      if (t.kind === 'machine' && (solid.has(k(c.x, c.y + 1)) || k(c.x, c.y + 1) === door)) return false;
    }
    add(t, { x, y });
    if (solid.has(door)) return false;
    // 입구에서 모든 기계 앞과 환전대·쓰레기통까지 걸어갈 수 있어야 한다
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
      if ((o.kind !== 'fix' && o.kind !== 'bin') || o.ref === 'robot' || !o.holder.pos) return true;
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
    const x = g.x + pos.x * CW, y = g.y + pos.y * CH;
    if (t.wall) return { x: x + 4, y: g.y - 56, w: t.w * CW - 8, h: 30 };
    if (t.kind === 'machine') return { x: x + 3, y: y - 26, w: t.w * CW - 6, h: CH + 22 };
    if (t.kind === 'fix' || t.kind === 'bin') return { x: x + 8, y: y + 4, w: CW - 16, h: CH - 12 };
    return { x: x + 4, y: y - 12, w: t.w * CW - 8, h: CH + 6 };
  }
  const standPoint = (g, m) => ({ x: g.x + (m.pos.x + DATA.MACHINES[m.type].footprint / 2) * CW, y: g.y + (m.pos.y + 2) * CH - 10 });
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

  // 기계 하나. o: {down}
  function machine(m, r, o) {
    const def = DATA.MACHINES[m.type], col = CABINET[m.type];
    const x = r.x, y = r.y, w = r.w, h = r.h;
    UI.rect(x + 4, y + h - 4, w, 8, 'rgba(20,50,77,0.25)');
    UI.framed({ x, y, w, h }, col[0], 2);
    UI.rect(x, y, w, 14, '#ffffff'); UI.rect(x + 3, y + 3, w - 6, 8, col[0]); // 윗면
    const glass = { x: x + 5, y: y + 18, w: w - 10, h: h - 38 };
    UI.framed(glass, o.down ? '#8b98a5' : '#d8f1ff', 2);
    // 안의 인형(많을수록 많이 보인다)
    const items = [];
    Object.keys(m.load).forEach((id) => { for (let i = 0; i < m.load[id].qty; i++) items.push(Sim.info.doll(id)); });
    if (def.kind === 'timer') {
      if (items.length) dollIcon(glass.x + glass.w / 2 - 14, glass.y + glass.h - 29, items[0], 4);
      UI.text('10.00', x + w / 2, glass.y + 8, 14, C.alert);
    } else {
      const per = Math.max(1, Math.floor((glass.w - 2) / 11));
      const show = Math.min(items.length, per * 3);
      for (let i = 0; i < show; i++) {
        const d = items[Math.floor(i * items.length / show)], row = Math.floor(i / per);
        dollIcon(glass.x + 2 + (i % per) * 11 + (row % 2) * 3, glass.y + glass.h - 12 - row * 9, d, d.size === 'L' ? 2 : 1.5);
      }
      UI.rect(glass.x + glass.w / 2 - 1, glass.y, 2, 8, '#44505c'); UI.rect(glass.x + glass.w / 2 - 4, glass.y + 8, 8, 3, '#44505c'); // 집게
    }
    if (!items.length) UI.text('비었음', x + w / 2, glass.y + glass.h / 2, 14, C.alert);
    UI.rect(x, y + h - 16, w, 16, col[1]);
    UI.rect(x + w / 2 - 8, y + h - 11, 5, 5, '#ffd84a'); UI.rect(x + w / 2 + 3, y + h - 11, 5, 5, '#d9455f');
    if (m.mods.durable) UI.rect(x + 3, y + h - 12, 6, 6, '#ffffff');
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
    if (key === 'exchange') {
      const auto = !!st.equip.exchanger;
      UI.framed(r, auto ? '#2aa198' : '#c79a6a', 2);
      UI.rect(x, y, w, 10, auto ? '#4cc4ba' : '#e0b988');
      if (auto) UI.rect(x + 8, y + 14, w - 16, 10, '#14324d');
      UI.coin(x + w / 2 - 8, y + h - 20, 2);
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
  function decor(id, r) {
    const draw = ART[id], cx = r.x + r.w / 2, b = r.y + r.h - 2;
    const wall = Sim.decorDef(id).wall;
    if (!wall) UI.rect(r.x + 6, b - 2, r.w - 8, 6, 'rgba(20,50,77,0.2)');
    if (draw) draw(r, cx, b); else UI.framed({ x: r.x + 6, y: r.y + 10, w: r.w - 12, h: r.h - 16 }, '#c9d9e6', 2);
  }

  // 놓는 것 하나를 r에 그린다. o: {selected, down, ghost('ok'|'no')}
  function thing(st, t, r, o) {
    o = o || {};
    if (t.kind === 'machine') machine(t.ref, r, o);
    else if (t.kind === 'fix') fixture(st, t.ref, r);
    else if (t.kind === 'bin') bin(t.ref.big, r);
    else decor(t.ref.id, r);
    const x = r.x, y = r.y, w = r.w, h = r.h;
    if (o.selected) [[x - 5, y - 5, w + 10, 3], [x - 5, y + h + 2, w + 10, 3], [x - 5, y - 5, 3, h + 10], [x + w + 2, y - 5, 3, h + 10]].forEach((a) => UI.rect(a[0], a[1], a[2], a[3], '#ffb300'));
    if (o.ghost) UI.rect(x - 2, y - 2, w + 4, h + 4, o.ghost === 'ok' ? 'rgba(60,200,110,0.35)' : 'rgba(217,69,95,0.45)');
  }
  // 앞뒤 순서: 아래 줄에 있는 것이 앞
  const depth = (g, t) => (t.wall ? -1000 : g.y + (t.holder.pos.y + 1) * CH);

  return { CW, CH, FIX_NAME, geom, things, stored, canPlace, autoPlace, rectOf, depth, standPoint, doorPoint, room, thing, dollIcon, TASTE_COLOR };
})();
