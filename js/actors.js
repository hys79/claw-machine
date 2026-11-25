// 영업 화면의 인물: 길찾기, 대표 손님의 행동, 주인공의 작업(걸어가서 처리하는 모습).
// 계산은 Sim이 하고, 여기서는 보여 주는 움직임을 맡는다. 단, 플레이어의 작업은 주인공이 도착해 동작을 마친 순간에 Sim에 반영한다.
// 시간(dt)은 배속이 곱해진 값이라 배속을 올리면 모두 함께 빨라진다.
const Actors = (function () {
  const MAX_CUSTOMERS = 16;
  const SPEED = { customer: 110, hero: 210 };   // 1배속 이동 속도(px/초)
  const STAY = 1.6;                              // 볼일을 마친 손님이 자리에 머무는 시간(초)

  let st = null, g = null, solid = null;
  let customers = [], hero = null, litter = [], jobs = [], job = null, litterId = 0;

  // ---------- 격자와 길찾기 ----------
  const key = (x, y) => x + ',' + y;
  const inside = (x, y) => x >= 0 && y >= 0 && x < g.cols && y < g.rows;
  const free = (x, y) => inside(x, y) && !solid.has(key(x, y));
  const feet = (c) => ({ x: g.x + (c.x + 0.5) * ShopView.CW, y: g.y + (c.y + 1) * ShopView.CH - 10 }); // 칸에 선 발 위치
  const cellOf = (p) => ({ x: Math.max(0, Math.min(g.cols - 1, Math.floor((p.x - g.x) / ShopView.CW))), y: Math.max(0, Math.min(g.rows - 1, Math.floor((p.y - g.y) / ShopView.CH))) });
  const NEXT = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // from에서 가까운 순서의 빈 칸 목록(줄 서는 자리, 가장 가까운 빈 칸 찾기)
  function spread(from, count) {
    const out = [], seen = new Set([key(from.x, from.y)]), q = [from];
    while (q.length && out.length < count) {
      const c = q.shift();
      if (free(c.x, c.y)) out.push(c);
      NEXT.forEach(([dx, dy]) => { const x = c.x + dx, y = c.y + dy; if (inside(x, y) && !seen.has(key(x, y))) { seen.add(key(x, y)); q.push({ x, y }); } });
    }
    return out;
  }
  // 칸 사이의 최단 경로(너비 우선 탐색). 길이 없으면 null
  function bfs(a, b) {
    const prev = new Map([[key(a.x, a.y), null]]), q = [a];
    while (q.length) {
      const c = q.shift();
      if (c.x === b.x && c.y === b.y) {
        const path = [];
        for (let n = c; n; n = prev.get(key(n.x, n.y))) path.unshift(n);
        return path;
      }
      NEXT.forEach(([dx, dy]) => {
        const x = c.x + dx, y = c.y + dy;
        if (free(x, y) && !prev.has(key(x, y))) { prev.set(key(x, y), c); q.push({ x, y }); }
      });
    }
    return null;
  }
  // 두 점 사이를 곧장 걸어도 장애물에 닿지 않는지(꺾이는 점을 줄여 자연스럽게 걷게 한다)
  function clearLine(p, q) {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 8);
    for (let i = 1; i < n; i++) {
      const x = p.x + (q.x - p.x) * i / n, y = p.y + (q.y - p.y) * i / n;
      for (const off of [-9, 9]) { const c = cellOf({ x: x + off, y }); if (!free(c.x, c.y)) return false; }
    }
    return true;
  }
  function route(from, to) {
    const path = bfs(cellOf(from), cellOf(to));
    if (!path) return [to];
    const pts = path.slice(1).map(feet);
    if (pts.length) pts[pts.length - 1] = to; else pts.push(to);
    const out = [];
    let cur = from, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clearLine(cur, pts[j])) j--;
      out.push(pts[j]); cur = pts[j]; i = j + 1;
    }
    return out;
  }
  // 목적지를 정한다(같은 곳이면 길을 다시 찾지 않는다)
  function setGoal(a, p) {
    if (a.goal && Math.abs(a.goal.x - p.x) < 1 && Math.abs(a.goal.y - p.y) < 1) return;
    a.goal = { x: p.x, y: p.y };
    a.path = route(a, a.goal);
  }
  function walk(a, speed, dt) {
    let left = speed * dt;
    a.moving = false;
    while (left > 0 && a.path && a.path.length) {
      const t = a.path[0], dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 2) a.left = dx < 0;
      a.moving = a.moving || d > 0.5;
      if (d <= left) { a.x = t.x; a.y = t.y; left -= d; a.path.shift(); } else { a.x += dx / d * left; a.y += dy / d * left; left = 0; }
    }
    return !a.path || !a.path.length;
  }

  // ---------- 자리 ----------
  const thing = (k) => ShopView.things(st).find((t) => t.key === k);
  // 놓인 것 앞에 서는 칸: 기계는 바로 아래, 설비는 옆의 빈 칸
  function frontCell(k) {
    const t = thing(k);
    if (!t || !t.holder.pos) return { x: g.door.x, y: g.door.y };
    const p = t.holder.pos;
    if (t.kind === 'machine') return { x: p.x + Math.floor((t.w - 1) / 2), y: p.y + 1 };
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (free(p.x + dx, p.y + dy) && bfs({ x: g.door.x, y: g.door.y }, { x: p.x + dx, y: p.y + dy })) return { x: p.x + dx, y: p.y + dy };
    return spread(p, 1)[0] || p;
  }
  const storeCell = () => spread({ x: g.cols - 1, y: 0 }, 1)[0];
  const randomCell = (seed) => { const list = spread({ x: g.door.x, y: g.door.y }, g.cols * g.rows); return list[(seed * 7 + 3) % list.length]; };

  // ---------- 시작 ----------
  function reset(state) {
    st = state; g = ShopView.geom(st.shopLevel);
    solid = new Set();
    ShopView.things(st).forEach((t) => { if (!t.wall && t.holder.pos) for (let i = 0; i < t.w; i++) solid.add(key(t.holder.pos.x + i, t.holder.pos.y)); });
    customers = []; litter = []; jobs = []; job = null;
    const start = feet(spread({ x: 1, y: g.rows - 1 }, 1)[0]);
    hero = { x: start.x, y: start.y, path: [], goal: null, left: false, moving: false, carry: null, anim: null };
  }

  // ---------- 손님 ----------
  const find = (id) => customers.find((a) => a.id === id);
  function spawn(e) {
    if (customers.length >= MAX_CUSTOMERS) return; // 대표 손님만 그린다
    const P = Cutscene.art.NPC_PALS;
    const pal = e.cat === 'normal' ? P[e.c % P.length] : P[(e.cat === 'mania' ? 1 : 2) % P.length];
    const door = ShopView.doorPoint(g);
    const a = { id: e.c, cat: e.cat, pal, x: door.x, y: door.y + 6, path: [], goal: null, state: 'browse', target: null, since: 0, dwell: 0, wantLeave: false, left: true, moving: false };
    setGoal(a, feet(randomCell(e.c))); // 들어와서 둘러본다
    customers.push(a);
  }
  function onEvent(e) {
    if (e.type === 'arrive') { spawn(e); return null; }
    const a = e.c != null ? find(e.c) : null;
    if (e.type === 'litter') {
      const base = a || feet(randomCell(++litterId * 5));
      const c = cellOf(base), spot = free(c.x, c.y) ? { x: base.x, y: base.y } : feet(spread(c, 1)[0]);
      litter.push({ id: ++litterId, x: spot.x + ((litterId * 17) % 25) - 12, y: spot.y - ((litterId * 7) % 8), kind: litterId % 3 });
      return null;
    }
    if (!a) return null;
    if (e.type === 'play' || e.type === 'win') { a.state = 'play'; a.target = 'm' + e.m; a.since = a.since || e.c; }
    else if (e.type === 'exchange') { a.state = 'play'; a.target = 'fexchange'; a.since = e.c; }
    else if (e.type === 'leave' || e.type === 'balk') a.wantLeave = true; // 자리에 가서 잠깐 머문 뒤 나간다
    return a;
  }
  function updateCustomers(dt) {
    const door = ShopView.doorPoint(g), lines = {};
    customers.forEach((a) => { if (a.state === 'play') (lines[a.target] = lines[a.target] || []).push(a); });
    // 같은 곳을 쓰는 손님은 앞 칸부터 차례로 줄을 선다
    Object.keys(lines).forEach((k) => {
      const spots = spread(frontCell(k), lines[k].length);
      lines[k].sort((a, b) => a.id - b.id).forEach((a, i) => {
        const p = feet(spots[Math.min(i, spots.length - 1)]);
        a.slot = i;
        setGoal(a, { x: p.x + (i >= spots.length ? 10 : 0), y: p.y });
      });
    });
    customers.forEach((a) => {
      const there = walk(a, SPEED.customer, dt);
      a.dwell = there ? a.dwell + dt : 0;
      if (a.state === 'browse' && there && a.dwell > 1.5 && !a.wantLeave) { a.dwell = 0; setGoal(a, feet(randomCell(a.id + Math.floor(a.x)))); }
      if (a.wantLeave && a.state !== 'leave' && a.dwell > (a.state === 'play' ? STAY : 0.4)) { a.state = 'leave'; setGoal(a, { x: door.x, y: door.y + 8 }); }
    });
    customers = customers.filter((a) => !(a.state === 'leave' && !a.moving && Math.hypot(a.x - door.x, a.y - door.y - 8) < 4));
  }

  // ---------- 주인공의 작업 ----------
  const same = (a, b) => a.type === b.type && a.m === b.m && a.litter === b.litter;
  // 일을 맡긴다. 이미 맡긴 일이면 false
  function enqueue(j) {
    const x = { type: j.type, m: j.m == null ? null : j.m, litter: j.litter == null ? null : j.litter };
    if ((job && same(job, x)) || jobs.some((o) => same(o, x))) return false;
    jobs.push(x);
    return true;
  }
  // 맡긴 상태: 0 = 하고 있는 중, 1부터 = 대기 순번, -1 = 맡기지 않음
  function jobState(type, m) {
    if (job && job.type === type && job.m === (m == null ? null : m)) return 0;
    const i = jobs.findIndex((o) => o.type === type && o.m === (m == null ? null : m));
    return i < 0 ? -1 : i + 1;
  }
  const go = (cell) => ({ go: feet(cell) });
  const work = (anim, sec, end) => ({ anim, sec, end });
  function plan(j, day, hooks) {
    const trash = () => { // 가장 가까운 쓰레기통 앞
      const cells = Sim.info.placedBins(st).map((b) => frontCell('b' + b.uid));
      const dist = (c) => { const p = feet(c); return Math.hypot(p.x - hero.x, p.y - hero.y); };
      return cells.sort((a, b) => dist(a) - dist(b))[0] || { x: g.door.x, y: g.door.y };
    };
    const pick = (l) => [{ go: { x: l.x, y: l.y + 2 } }, work('sweep', 0.45, () => { litter = litter.filter((o) => o !== l); hero.carry = 'trash'; hooks.sfx('pop'); })];
    const finish = () => { hooks.done(day.act(j.type, j.m), j); };
    if (j.type === 'refill') return [go(storeCell()), work('take', 0.5, () => { hero.carry = 'box'; hooks.sfx('click'); }), go(frontCell('m' + j.m)), work('pour', 0.9, () => { hero.carry = null; finish(); })];
    if (j.type === 'repair') return [go(frontCell('m' + j.m)), work('hammer', 1.4, () => { finish(); })];
    if (j.type === 'exchange') return [go(frontCell('fexchange')), work('coin', 0.8, () => { finish(); })];
    if (j.type === 'litter') {
      const l = litter.find((o) => o.id === j.litter);
      return l ? pick(l).concat([go(trash()), work('dump', 0.45, () => { hero.carry = null; day.pickLitter(); hooks.sfx('confirm'); })]) : [];
    }
    // 청소: 가까운 쓰레기부터 모두 주워 쓰레기통에 버린다
    const rest = litter.slice(), steps = [];
    let at = { x: hero.x, y: hero.y };
    while (rest.length) {
      rest.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
      const l = rest.shift(); steps.push(...pick(l)); at = l;
    }
    return steps.concat([go(trash()), work('dump', 0.6, () => { hero.carry = null; finish(); })]);
  }
  function stopJob(day) {
    if (job && job.type !== 'litter') day.claim(job.type, job.m, false);
    job = null; hero.carry = null; hero.anim = null;
  }
  function updateHero(dt, day, hooks) {
    const tasks = day.tasks();
    const alive = (j) => (j.type === 'litter' ? (job === j && job.started) || litter.some((l) => l.id === j.litter) : tasks.some((k) => k.type === j.type && k.m === j.m));
    jobs = jobs.filter(alive);
    if (job && !alive(job)) { stopJob(day); hero.path = []; hero.goal = null; } // 그사이에 해결된 일은 그만둔다
    while (!job && jobs.length) {
      const j = jobs.shift();
      const k = tasks.find((x) => x.type === j.type && x.m === j.m);
      if (j.type === 'refill' && k && k.noStock) { hooks.noStock(); continue; }
      j.steps = plan(j, day, hooks);
      if (!j.steps.length) continue;
      j.i = 0; j.t = 0; j.started = true; job = j;
      if (j.type !== 'litter') day.claim(j.type, j.m, true);
      hero.goal = null;
    }
    if (!job) { hero.moving = false; return; }
    const s = job.steps[job.i];
    if (s.go) {
      hero.anim = null;
      setGoal(hero, s.go);
      if (walk(hero, SPEED.hero, dt)) { job.i++; job.t = 0; }
    } else {
      hero.moving = false; hero.anim = s.anim;
      const before = job.t; job.t += dt;
      if (s.anim === 'hammer' && Math.floor(before / 0.4) !== Math.floor(job.t / 0.4)) hooks.sfx('hammer');
      if (job.t >= s.sec) { const j = job; s.end(); if (job === j) { job.i++; job.t = 0; } }
    }
    if (job && job.i >= job.steps.length) { job = null; hero.anim = null; hero.carry = null; }
  }

  function update(dt, day, hooks) {
    updateCustomers(dt);
    updateHero(dt, day, hooks);
  }
  // 누른 곳의 쓰레기
  function litterAt(p) {
    const l = litter.find((o) => Math.abs(p.x - o.x) <= 16 && Math.abs(p.y - (o.y - 4)) <= 16);
    return l ? l.id : null;
  }

  // ---------- 그리기 ----------
  function person(ctx, a, pal, rows, now) {
    const img = Cutscene.art.outlinedImg(rows, pal);
    const s = 2, bob = a.moving ? Math.floor(now * 10) % 2 * 2 : 0;
    UI.rect(a.x - 12, a.y - 3, 24, 5, 'rgba(20,50,77,0.22)');
    ctx.save();
    ctx.translate(Math.round(a.x), Math.round(a.y - img.height * s - bob));
    if (a.moving && a.left) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width * s / 2, 0, img.width * s, img.height * s);
    ctx.restore();
    return a.y - img.height * s - bob; // 머리 위 y
  }
  function drawCustomer(ctx, a, now) {
    const art = Cutscene.art;
    const rows = a.moving ? art.ME_WALK[Math.floor(now * 8 + a.id) % 4] : (a.state === 'play' ? art.ME_BACK : art.ME_FRONT);
    const playing = a.state === 'play' && !a.moving && a.slot === 0;
    const top = person(ctx, playing ? Object.assign({}, a, { x: a.x + Math.floor(now * 4 + a.id) % 2 }) : a, a.pal, rows, now);
    if (a.cat !== 'normal') UI.text(a.cat === 'kpop' ? '팬' : '마니아', a.x, top - 8, 14, a.cat === 'kpop' ? '#8a4fc0' : '#8a5a1a', 'center');
  }
  function box(x, y) { UI.framed({ x: x - 11, y, w: 22, h: 16 }, '#c79a6a', 2); UI.rect(x - 3, y, 6, 16, '#e0b988'); }
  function drawHero(ctx, now) {
    const art = Cutscene.art, a = hero, f = Math.floor(now * 8) % 2;
    const working = !!a.anim && !a.moving;
    const rows = a.moving ? art.ME_WALK[Math.floor(now * 9) % 4] : (working ? art.ME_BACK : art.ME_FRONT);
    const bend = working && (a.anim === 'sweep' || a.anim === 'dump') ? f * 4 : 0;
    const top = person(ctx, Object.assign({}, a, { y: a.y + bend }), art.ME_PAL, rows, now);
    if (a.carry === 'box') box(a.x, top - 14);
    if (a.carry === 'trash') { UI.framed({ x: a.x + (a.left ? -22 : 8), y: a.y - 20, w: 14, h: 12 }, '#44505c', 2); UI.rect(a.x + (a.left ? -18 : 12), a.y - 24, 6, 4, '#44505c'); }
    if (working) {
      if (a.anim === 'pour') { const k = (now * 2.5) % 1; box(a.x, top - 12 - f * 3); ['#ff9fbc', '#ffd84a', '#7a8cf0'].forEach((c, i) => UI.rect(a.x - 12 + i * 10, top - 16 - ((k + i / 3) % 1) * 22, 6, 6, c)); }
      else if (a.anim === 'take') box(a.x, top - 4 - f * 6);
      else if (a.anim === 'hammer') { const up = f ? -10 : 2; UI.rect(a.x + 10, top + 12 + up, 4, 16, '#8a6a4a'); UI.framed({ x: a.x + 5, y: top + 6 + up, w: 14, h: 8 }, '#7d8b99', 2); if (!f) UI.rect(a.x + 18, top + 8, 5, 5, '#ffd84a'); }
      else if (a.anim === 'coin') UI.coin(a.x - 8, top - 18 - f * 6, 2);
      else if (a.anim === 'sweep') { const dx = f ? 10 : -10; UI.rect(a.x + dx, a.y - 24, 3, 20, '#8a6a4a'); UI.framed({ x: a.x + dx - 6, y: a.y - 6, w: 15, h: 6 }, '#ffd84a', 1); }
      else if (a.anim === 'dump') UI.rect(a.x - 3, top - 4 + f * 10, 7, 7, '#9a8a6a');
    }
    UI.text('▼', a.x, top - (a.carry === 'box' || working ? 34 : 10) - f, 14, '#ffb300', 'center', CFG.COLOR.ink, 4); // 주인공 표시
  }
  function drawLitter(o) {
    UI.rect(o.x - 8, o.y - 2, 16, 4, 'rgba(20,50,77,0.18)');
    if (o.kind === 0) { UI.framed({ x: o.x - 5, y: o.y - 12, w: 10, h: 10 }, '#d9455f', 2); UI.rect(o.x - 5, o.y - 9, 10, 3, '#ffffff'); }        // 빈 컵
    else if (o.kind === 1) { UI.framed({ x: o.x - 7, y: o.y - 8, w: 13, h: 6 }, '#ffffff', 2); UI.rect(o.x - 2, o.y - 12, 6, 5, '#c9d9e6'); }  // 구긴 종이
    else { UI.framed({ x: o.x - 6, y: o.y - 9, w: 12, h: 7 }, '#ffb347', 2); UI.rect(o.x + 5, o.y - 11, 5, 4, '#ffd84a'); }                       // 과자 봉지
  }
  // 놓인 것들과 앞뒤를 맞춰 그릴 목록
  function drawList(ctx, now) {
    return litter.map((o) => ({ y: o.y - 20, f: () => drawLitter(o) }))
      .concat(customers.map((a) => ({ y: a.y, f: () => drawCustomer(ctx, a, now) })))
      .concat([{ y: hero.y + 1, f: () => drawHero(ctx, now) }]);
  }
  const position = (id) => find(id);

  return { reset, onEvent, update, enqueue, jobState, litterAt, drawList, position, state: () => ({ hero, customers, litter, job, jobs }) };
})();
