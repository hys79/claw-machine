// 가게 바닥 그리기(3/4 탑다운): 격자 바닥, 벽, 입구, 환전대, 기계(윗면 + 앞면). 계산은 하지 않는다.
// 좌표는 가운데 960 영역 기준. 기계의 위치 m.pos = {x, y}는 격자 칸이며, 바로 아래 칸은 손님이 서는 자리다.
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
    return { cols, rows, x, y, w, h, door: { x: cols - 1, y: rows - 1 }, exchange: { x: 0, y: rows - 1 } };
  }
  const width = (m) => DATA.MACHINES[m.type].footprint;      // 대형 기계는 두 칸
  const cellXY = (g, cx, cy) => ({ x: g.x + cx * CW, y: g.y + cy * CH });
  // 기계의 화면 영역(윗면 포함)과 손님이 서는 자리
  const machineRect = (g, m) => ({ x: g.x + m.pos.x * CW + 3, y: g.y + m.pos.y * CH - 26, w: width(m) * CW - 6, h: CH + 22 });
  const standPoint = (g, m) => ({ x: g.x + (m.pos.x + width(m) / 2) * CW, y: g.y + (m.pos.y + 2) * CH - 10 });
  const doorPoint = (g) => ({ x: g.x + (g.door.x + 0.5) * CW, y: g.y + g.h - 4 });

  // 놓을 수 있는 칸인지: 기계끼리 겹치지 않고, 아래 칸(손님 자리)이 비어 있고, 입구·환전대를 막지 않는다.
  function canPlace(st, m, cx, cy) {
    const g = geom(st.shopLevel), w = width(m);
    if (cx < 0 || cy < 0 || cx + w > g.cols || cy > g.rows - 2) return false;
    const blocks = (px, py) => (px === g.door.x || px === g.exchange.x) && py === g.rows - 1;
    for (let i = 0; i < w; i++) if (blocks(cx + i, cy) || blocks(cx + i, cy + 1)) return false;
    return st.machines.every((o) => {
      if (o === m || !o.pos) return true;
      const overlapX = cx < o.pos.x + width(o) && o.pos.x < cx + w;
      return !overlapX || Math.abs(cy - o.pos.y) >= 2;       // 같은 줄이나 바로 위아래 줄은 안 된다
    });
  }
  // 자리가 없는 기계를 빈 곳에 놓는다.
  function autoPlace(st) {
    const g = geom(st.shopLevel);
    st.machines.forEach((m) => {
      if (m.pos && canPlace(st, m, m.pos.x, m.pos.y)) return;
      m.pos = null;
      for (let y = 0; y < g.rows - 1 && !m.pos; y += 1) for (let x = 0; x < g.cols && !m.pos; x++) if (canPlace(st, m, x, y)) m.pos = { x, y };
      if (!m.pos) { // 지금 배치로는 자리가 없으면 전부 다시 놓는다
        st.machines.forEach((o) => { o.pos = null; });
        st.machines.slice().sort((a, b) => width(b) - width(a)).forEach((o) => {
          for (let y = 0; y < g.rows - 1 && !o.pos; y++) for (let x = 0; x < g.cols && !o.pos; x++) if (canPlace(st, o, x, y)) o.pos = { x, y };
          if (!o.pos) o.pos = { x: 0, y: 0 };
        });
      }
    });
  }

  function room(st, opts) {
    const g = geom(st.shopLevel);
    // 벽
    UI.rect(g.x - 8, g.y - WALL - 4, g.w + 16, g.h + WALL + 12, C.ink);
    UI.rect(g.x - 4, g.y - WALL, g.w + 8, WALL, '#dcebf7');
    UI.rect(g.x - 4, g.y - 12, g.w + 8, 12, '#b8d2e8');
    for (let i = 0; i * 28 < g.w + 8; i++) UI.rect(g.x - 4 + i * 28, g.y - WALL, Math.min(14, g.w + 8 - i * 28), 12, i % 2 ? '#6ab0f0' : C.blue);
    // 바닥
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const p = cellXY(g, x, y);
      UI.rect(p.x, p.y, CW, CH, (x + y) % 2 ? '#eef3f8' : '#e1eaf2');
      if (opts && opts.grid) { UI.rect(p.x, p.y, CW, 1, '#a9c0d4'); UI.rect(p.x, p.y, 1, CH, '#a9c0d4'); }
    }
    // 환전대(왼쪽 아래)
    const e = cellXY(g, g.exchange.x, g.exchange.y);
    const gear = !!st.equip.exchanger;
    UI.framed({ x: e.x + 8, y: e.y + 4, w: CW - 16, h: CH - 14 }, gear ? '#2aa198' : '#c79a6a', 2);
    UI.rect(e.x + 8, e.y + 4, CW - 16, 10, gear ? '#4cc4ba' : '#e0b988');
    UI.coin(e.x + CW / 2 - 8, e.y + 22, 2);
    // 입구(오른쪽 아래)
    const d = cellXY(g, g.door.x, g.door.y);
    UI.rect(d.x + 4, d.y + CH - 10, CW - 8, 14, '#8a6a4a');
    UI.text('입구', d.x + CW / 2, d.y + CH - 20, 14, C.sub);
    // 쓰레기통
    UI.framed({ x: g.x + CW + 14, y: g.y + g.h - 30, w: st.equip.bin ? 30 : 22, h: 26 }, '#7d8b99', 2);
  }

  function dollIcon(x, y, d, s) {
    const c = TASTE_COLOR[d.taste[0]] || '#ffffff';
    UI.rect(x, y + 2 * s, 7 * s, 5 * s, c);
    UI.rect(x, y, 2 * s, 2 * s, c); UI.rect(x + 5 * s, y, 2 * s, 2 * s, c);
    UI.rect(x + 2 * s, y + 3 * s, s, s, C.ink); UI.rect(x + 4 * s, y + 3 * s, s, s, C.ink);
  }

  // 기계 하나. o: {x, y(영역 왼쪽 위), selected, down, ghost('ok'|'no')}
  function machine(m, r, o) {
    o = o || {};
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
    if (o.selected) { [[x - 5, y - 5, w + 10, 3], [x - 5, y + h + 2, w + 10, 3], [x - 5, y - 5, 3, h + 10], [x + w + 2, y - 5, 3, h + 10]].forEach((a) => UI.rect(a[0], a[1], a[2], a[3], '#ffd84a')); }
    if (o.ghost) UI.rect(x - 2, y - 2, w + 4, h + 4, o.ghost === 'ok' ? 'rgba(60,200,110,0.35)' : 'rgba(217,69,95,0.45)');
  }

  return { CW, CH, geom, width, cellXY, machineRect, standPoint, doorPoint, canPlace, autoPlace, room, machine, dollIcon, TASTE_COLOR };
})();
