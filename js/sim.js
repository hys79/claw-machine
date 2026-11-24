// 시뮬레이션 코어: 화면(DOM·Canvas)과 무관한 순수 계산. 하루를 한 번에 돌려 결과와 사건 로그를 돌려준다.
// 영업 화면은 이 결과(틱별 사건 로그)를 재생해서 대표 손님만 그린다. 수치는 CFG.SIM, 데이터는 DATA.DOLLS/MACHINES/CUSTOMERS.
// 시드 기반 난수라 같은 상태·같은 하루는 항상 같은 결과가 나온다(배속·재현·테스트).
const Sim = (function () {
  const Z = CFG.SIM;
  const TICKS = (Z.CLOSE - Z.OPEN) * 60;
  const dollMap = {};
  DATA.DOLLS.forEach((d) => { dollMap[d.id] = d; });
  const SIZES = ['S', 'M', 'L'];

  // ---------- 난수 ----------
  function makeRng(seed) {
    let a = seed >>> 0;
    const r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    r.poisson = (lam) => { if (lam <= 0) return 0; const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
    r.pickW = (items, weights) => {
      let sum = 0; for (let i = 0; i < weights.length; i++) sum += weights[i];
      let x = r() * sum;
      for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
      return items[items.length - 1];
    };
    return r;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round10 = (v) => Math.round(v / 10) * 10;

  // ---------- 조회 ----------
  const doll = (id) => dollMap[id];
  const mdef = (m) => DATA.MACHINES[m.type];
  const shopLv = (st) => Z.SHOP[st.shopLevel];
  const whLv = (st) => Z.WAREHOUSE[st.warehouseLevel];
  const slotsUsed = (m) => { const def = mdef(m); let n = 0; Object.keys(m.load).forEach((id) => { n += m.load[id].qty * def.slotCost[doll(id).size]; }); return n; };
  const loadQty = (m) => { let n = 0; Object.keys(m.load).forEach((id) => { n += m.load[id].qty; }); return n; };
  const canHold = (m, d) => mdef(m).sizes.indexOf(d.size) >= 0;
  const footUsed = (st) => st.machines.reduce((n, m) => n + mdef(m).footprint, 0);
  const stockTotal = (st) => Object.keys(st.stock).reduce((n, id) => n + st.stock[id].qty, 0);
  const incomingTotal = (st) => st.incoming.reduce((n, o) => n + o.qty, 0);
  const isShowDay = (day) => day >= Z.SHOW.first && ((day - 1) % 7) === 5; // 토요일
  const dowOf = (day) => (day - 1) % 7;
  const trendBoost = (st, d) => (st.trend.tags.some((t) => d.tags.indexOf(t) >= 0) ? Z.TREND.appeal : 1);

  // ---------- 새 게임 ----------
  function newGame(playerName, shopName, seed) {
    const st = {
      v: 1, seed: seed == null ? (Date.now() & 0x7fffffff) : seed, playerName: playerName || '', shopName: shopName || '',
      day: 1, money: CFG.START_MONEY, rank: 1, shopLevel: 0, warehouseLevel: 0, reputation: Z.START_REP, popularity: 0,
      totalRevenue: 0, machines: [], stock: {}, incoming: [], trend: { tags: [], until: 0 }, history: [], nextId: 1,
      weather: 'sunny', env: null, bankrupt: false,
    };
    addMachine(st, 'standard', true);
    addMachine(st, 'mini', true);
    [['chick', 14], ['rocket', 12], ['breadduck', 10], ['roundbear', 10], ['berrybunny', 8], ['penguin', 8], ['bigbear', 3]].forEach(([id, q]) => addStock(st, id, q, doll(id).cost));
    startOfDay(st);
    return st;
  }

  function addMachine(st, type, free) {
    const def = DATA.MACHINES[type];
    const m = { id: st.nextId++, type, strength: 3, price: def.priceDef, plan: {}, load: {}, age: 0 };
    st.machines.push(m);
    return m;
  }

  // ---------- 재고(이동 평균 원가) ----------
  function addStock(st, id, qty, unitCost) {
    const s = st.stock[id] || (st.stock[id] = { qty: 0, cost: unitCost });
    s.cost = (s.cost * s.qty + unitCost * qty) / (s.qty + qty);
    s.qty += qty;
  }

  // ---------- 구매 / 확장 ----------
  function buyMachine(st, type) {
    const def = DATA.MACHINES[type];
    if (!def) return { ok: false, why: '없는 기계' };
    if (st.money < def.price) return { ok: false, why: '돈이 부족해요' };
    if (footUsed(st) + def.footprint > shopLv(st).slots) return { ok: false, why: '점포에 자리가 없어요' };
    st.money -= def.price;
    return { ok: true, machine: addMachine(st, type), cost: def.price };
  }
  // 기계 팔기: 구입가의 40%(중고). 안의 인형은 창고로 돌아간다.
  function sellMachine(st, id) {
    const i = st.machines.findIndex((m) => m.id === id);
    if (i < 0) return { ok: false, why: '없는 기계' };
    unloadAll(st, st.machines[i]);
    const gain = Math.round(mdef(st.machines[i]).price * 0.4);
    st.machines.splice(i, 1);
    st.money += gain;
    return { ok: true, gain };
  }
  function expandWarehouse(st) {
    const next = Z.WAREHOUSE[st.warehouseLevel + 1];
    if (!next) return { ok: false, why: '최대 단계예요' };
    if (st.money < next.cost) return { ok: false, why: '돈이 부족해요' };
    st.money -= next.cost; st.warehouseLevel++;
    return { ok: true, cost: next.cost };
  }
  function expandShop(st) {
    const next = Z.SHOP[st.shopLevel + 1];
    if (!next) return { ok: false, why: '최대 단계예요' };
    if (st.rank < st.shopLevel + 2) return { ok: false, why: '가게 랭크가 더 필요해요' };
    if (st.money < next.cost) return { ok: false, why: '돈이 부족해요' };
    st.money -= next.cost; st.shopLevel++;
    return { ok: true, cost: next.cost };
  }

  // ---------- 발주 ----------
  function unitCost(st, id, qty) {
    const d = doll(id);
    let c = d.cost * (st.trend.tags.some((t) => d.tags.indexOf(t) >= 0) ? Z.TREND.price : 1);
    for (let i = 0; i < Z.BULK.length; i++) if (qty >= Z.BULK[i][0]) { c *= 1 - Z.BULK[i][1]; break; }
    return round10(c);
  }
  // items: [{id, qty}]. 입고는 다음 날 아침. 창고 용량(재고 + 입고 예정)을 넘으면 발주할 수 없다.
  function order(st, items) {
    let qty = 0, cost = 0;
    const lines = [];
    for (const it of items) {
      const d = doll(it.id);
      if (!d || it.qty <= 0) continue;
      if (d.rank > st.rank) return { ok: false, why: d.name + '은(는) 아직 취급할 수 없어요' };
      const uc = unitCost(st, it.id, it.qty);
      lines.push({ id: it.id, qty: it.qty, unit: uc });
      qty += it.qty; cost += uc * it.qty;
    }
    if (!qty) return { ok: false, why: '주문할 인형이 없어요' };
    if (stockTotal(st) + incomingTotal(st) + qty > whLv(st).cap) return { ok: false, why: '창고 공간이 부족해요' };
    if (st.money < cost) return { ok: false, why: '돈이 부족해요' };
    st.money -= cost;
    lines.forEach((l) => st.incoming.push({ id: l.id, qty: l.qty, unit: l.unit, arrive: st.day + 1 }));
    return { ok: true, cost, qty };
  }

  // ---------- 기계 채우기 ----------
  function freeSlots(m) { return mdef(m).slots - slotsUsed(m); }
  function loadMachine(st, m, id, qty) {
    const d = doll(id), s = st.stock[id];
    if (!d || !s || !canHold(m, d)) return 0;
    const per = mdef(m).slotCost[d.size];
    const n = Math.max(0, Math.min(qty, s.qty, Math.floor(freeSlots(m) / per)));
    if (!n) return 0;
    const l = m.load[id] || (m.load[id] = { qty: 0, cost: s.cost });
    l.cost = (l.cost * l.qty + s.cost * n) / (l.qty + n);
    l.qty += n;
    s.qty -= n;
    if (s.qty <= 0) delete st.stock[id];
    return n;
  }
  function unloadAll(st, m) {
    Object.keys(m.load).forEach((id) => { if (m.load[id].qty > 0) addStock(st, id, m.load[id].qty, m.load[id].cost); delete m.load[id]; });
  }
  function refill(st, m) { // 계획(plan)대로 창고에서 채운다
    let n = 0;
    Object.keys(m.plan).forEach((id) => {
      const have = m.load[id] ? m.load[id].qty : 0;
      if (m.plan[id] > have) n += loadMachine(st, m, id, m.plan[id] - have);
    });
    return n;
  }

  // ---------- 손님 선호 ----------
  const custTypes = DATA.CUSTOMERS;
  function appeal(st, ct, d, m) {
    let tagM = 1;
    if (d.tags.length) { let s = 0; d.tags.forEach((t) => { s += ct.tagW[t] || 1; }); tagM = s / d.tags.length; }
    const tier = d.tier === 'limited' ? 1.35 : (d.tier === 'rare' ? 1.2 : 1.0);
    const def = mdef(m);
    return tier * tagM * (ct.sizeW[d.size] || 1) * trendBoost(st, d) * (def.sizeAppeal[d.size] || 1) * def.appeal * (ct.machineW[m.type] || 1);
  }
  function grabProb(st, m, d, ct, env) {
    const def = mdef(m);
    const base = def.grab[d.size];
    if (!base) return 0;
    return clamp(base * Z.STRENGTH[m.strength - 1] * (1 - d.hard * 0.4) * ct.skill * (env.rain ? 1 : 1), 0, 0.6);
  }

  // ---------- 하루의 시작 ----------
  function startOfDay(st) {
    // 입고
    st.incoming = st.incoming.filter((o) => {
      if (o.arrive <= st.day) { addStock(st, o.id, o.qty, o.unit); return false; }
      return true;
    });
    const rng = makeRng(st.seed * 7919 + st.day * 31 + 5);
    // 유행: 7일마다 태그 2개
    if (st.day === 1 || st.day >= st.trend.until) {
      const tags = DATA.TAGS.filter((t) => ['희귀', '한정', '공연'].indexOf(t) < 0);
      const a = tags[Math.floor(rng() * tags.length)];
      let b = a; while (b === a) b = tags[Math.floor(rng() * tags.length)];
      st.trend = { tags: [a, b], until: st.day + Z.TREND.days };
    }
    const w = rng.pickW(Z.WEATHER, Z.WEATHER.map((x) => x[1]));
    st.weather = w[0];
    st.env = { weather: w[0], weatherMult: w[2], show: isShowDay(st.day), dow: dowOf(st.day) };
    return st.env;
  }

  // 오늘 예상 방문객
  function forecast(st) {
    const env = st.env || startOfDay(st);
    return Math.round(expectedVisitors(st, env));
  }
  function repMult(st) { return Z.REP_MULT[0] + (Z.REP_MULT[1] - Z.REP_MULT[0]) * (st.reputation / 100); }
  function expectedVisitors(st, env) {
    return Z.BASE_VISITORS * Z.DOW[env.dow] * env.weatherMult * repMult(st) * shopLv(st).foot * (0.5 + 0.5 * machineVariety(st));
  }
  // 기계/인형이 다양할수록(최대 1) 손님이 많이 들어온다
  function machineVariety(st) {
    const types = {}, dolls = {};
    st.machines.forEach((m) => { if (loadQty(m) > 0) { types[m.type] = 1; Object.keys(m.load).forEach((id) => { if (m.load[id].qty > 0) dolls[id] = 1; }); } });
    return clamp((Object.keys(dolls).length / 8) * 0.7 + (Object.keys(types).length / 3) * 0.3, 0.15, 1);
  }

  // ---------- 하루 시뮬레이션 ----------
  function runDay(st, opts) {
    opts = opts || {};
    const env = st.env || startOfDay(st);
    const rng = makeRng(st.seed * 1000003 + st.day * 17 + 3);
    const respond = opts.respond !== false;
    const fix = respond ? Z.RESPOND : Z.AUTO;
    const log = opts.log ? [] : null;
    const ev = (t, type, o) => { if (log) log.push(Object.assign({ t, type }, o)); };

    const show = env.show;
    const hw = Z.HOUR_W, hwSum = hw.reduce((a, b) => a + b, 0);
    const visitorsToday = expectedVisitors(st, env) * (show ? 1 + (Z.SHOW.mult - 1) * 0.35 : 1); // 공연일은 저녁에 몰린다
    const R = {
      day: st.day, weather: env.weather, show, expected: Math.round(visitorsToday),
      visitors: 0, players: 0, plays: 0, wins: 0, balk: { nothing: 0, budget: 0, queue: 0, empty: 0 }, claims: 0,
      revenue: 0, payout: 0, power: 0, repair: 0, rent: 0, upkeep: 0, satSum: 0,
      byMachine: [], byType: {}, hourly: new Array(Z.CLOSE - Z.OPEN).fill(0),
    };
    custTypes.forEach((c) => { R.byType[c.id] = { visitors: 0, plays: 0, revenue: 0 }; });

    // 기계 런타임 준비
    const mrt = st.machines.map((m) => {
      const def = mdef(m);
      const pb = clamp(Z.BREAK_BASE + m.age * Z.BREAK_AGE, 0, Z.BREAK_MAX);
      const brk = rng() < pb ? Math.floor(rng() * (TICKS - 60)) + 30 : -1;
      return { m, def, queue: [], acc: 0, down: false, downUntil: -1, breakAt: brk, refillAt: -1, plays: 0, wins: 0, rev: 0, payout: 0, downMin: 0, emptyMin: 0, repair: 0 };
    });
    const hourMult = (h) => {
      let x = hw[h - Z.OPEN];
      if (show && h >= Z.SHOW.from && h < Z.SHOW.to) x *= Z.SHOW.mult;
      return x;
    };
    // 공연일 가중치를 반영해 총합이 visitorsToday가 되도록 정규화
    let wsum = 0; for (let h = Z.OPEN; h < Z.CLOSE; h++) wsum += hourMult(h);

    let cid = 0;
    const customers = [];

    function pickCustomerType(h) {
      const dow = env.dow, weekend = dow >= 5;
      const ws = custTypes.map((c) => {
        let w = c.weight;
        const tm = c.time;
        const inH = h >= tm.hours[0] && h < tm.hours[1];
        w *= inH ? tm.mult : tm.off;
        if (weekend) w *= tm.weekend;
        if (show && tm.show) w *= tm.show;
        return w;
      });
      return rng.pickW(custTypes, ws);
    }

    function chooseTarget(c) {
      let best = 0; const opts2 = [];
      mrt.forEach((r) => {
        if (r.down) return;
        const qlen = r.queue.length;
        const qpen = 1 / (1 + 0.12 * qlen);
        const pf = clamp(r.def.ref / r.m.price, 0.5, 1.8);
        Object.keys(r.m.load).forEach((id) => {
          if (r.m.load[id].qty <= 0) return;
          const sc = appeal(st, c.ct, doll(id), r.m) * pf * qpen;
          opts2.push({ r, id, sc });
          if (sc > best) best = sc;
        });
      });
      if (!opts2.length) return { why: 'nothing' };
      const pPlay = Math.pow(best, 2) / (Math.pow(best, 2) + Math.pow(Z.CONV_K, 2));
      if (rng() > pPlay) return { why: 'nothing' };
      const pick = rng.pickW(opts2, opts2.map((o) => Math.pow(o.sc, 2)));
      return { r: pick.r, id: pick.id };
    }

    function leave(c, t, why) {
      c.left = true;
      if (c.plays > 0) {
        R.players++;
        let sat = c.sat;
        if (why === 'frustrated') sat -= 0.1;
        c.sat = clamp(sat, 0, 1);
        R.satSum += c.sat;
        if (c.sat < 0.2 && rng() < 0.35) { R.claims++; ev(t, 'claim', { c: c.id, type: c.ct.id }); }
      }
      ev(t, 'leave', { c: c.id, why, plays: c.plays, wins: c.wins, spent: c.spent });
    }

    function doPlay(r, c, t) {
      const m = r.m;
      // 원하던 인형이 없으면 남은 인형 중에서 다시 고른다
      if (!m.load[c.doll] || m.load[c.doll].qty <= 0) {
        const ids = Object.keys(m.load).filter((id) => m.load[id].qty > 0);
        if (!ids.length) { R.balk.empty++; ev(t, 'empty', { m: m.id, c: c.id }); leave(c, t, 'empty'); return; }
        c.doll = rng.pickW(ids, ids.map((id) => Math.pow(appeal(st, c.ct, doll(id), m), 2)));
      }
      const d = doll(c.doll);
      m.price; // 가격은 기계 설정값
      c.budget -= m.price; c.spent += m.price; c.plays++;
      R.plays++; R.revenue += m.price; r.plays++; r.rev += m.price;
      R.byType[c.ct.id].plays++; R.byType[c.ct.id].revenue += m.price;
      R.hourly[Math.floor(t / 60)] += m.price;
      let won = false, near = false;
      const p = grabProb(st, m, d, c.ct, env);
      for (let a = 0; a < r.def.attempts; a++) {
        if (!m.load[c.doll] || m.load[c.doll].qty <= 0) break;
        if (rng() < p) {
          won = true; c.wins++; R.wins++; r.wins++;
          const l = m.load[c.doll];
          R.payout += l.cost; r.payout += l.cost;
          l.qty--; if (l.qty <= 0) delete m.load[c.doll];
          ev(t, 'win', { c: c.id, m: m.id, doll: d.id, type: c.ct.id });
        } else if (rng() < 0.45) near = true;
      }
      if (!won) ev(t, 'play', { c: c.id, m: m.id, near, type: c.ct.id });
      // 만족도·계속 여부
      c.sat += 0.03; // 해 보는 재미
      if (won) { c.sat += 0.3 + (d.tier !== 'normal' ? 0.1 : 0); c.fails = 0; }
      else { c.sat -= near ? 0.02 : 0.045; c.fails++; }
      let cont;
      if (c.budget < m.price) cont = false;
      else if (won) cont = rng() < c.ct.win;
      else cont = rng() < clamp(1 - c.fails / (c.ct.patience + 1) + (near ? 0.15 : 0), 0, 0.95);
      if (!cont) { leave(c, t, c.budget < m.price ? 'budget' : (won ? 'happy' : 'frustrated')); return; }
      // 계속: 다시 줄 끝에 선다(줄이 없으면 바로 이어서 한다)
      c.waitFrom = t; r.queue.push(c);
    }

    // ---- 틱 루프 ----
    for (let t = 0; t < TICKS; t++) {
      const h = Z.OPEN + Math.floor(t / 60);
      // 고장·수리·보충
      mrt.forEach((r) => {
        if (r.breakAt === t) { r.down = true; r.downUntil = t + fix.delay; r.repair = Math.round(r.def.repair * fix.cost); ev(t, 'breakdown', { m: r.m.id }); }
        if (r.down && t >= r.downUntil) { r.down = false; ev(t, 'repaired', { m: r.m.id }); }
        if (r.down) r.downMin++;
        const used = slotsUsed(r.m), cap = r.def.slots;
        if (used === 0) r.emptyMin++;
        if (r.refillAt < 0 && used / cap < 0.25 && opts.refill !== false) r.refillAt = t + Z.REFILL_DELAY;
        if (r.refillAt >= 0 && t >= r.refillAt) {
          r.refillAt = -1;
          const n = refill(st, r.m);
          if (n) ev(t, 'refill', { m: r.m.id, n });
        }
      });
      // 도착
      const lam = visitorsToday * (hourMult(h) / wsum) / 60;
      const n = rng.poisson(lam);
      for (let i = 0; i < n; i++) {
        const ct = pickCustomerType(h);
        const c = { id: ++cid, ct, budget: Math.max(500, Math.round(ct.budget * Math.exp(rng.normal() * 0.35) / 100) * 100), sat: 0.55, fails: 0, plays: 0, wins: 0, spent: 0, arrive: t, waitFrom: t, left: false };
        R.visitors++; R.byType[ct.id].visitors++;
        ev(t, 'arrive', { c: c.id, type: ct.id, budget: c.budget });
        const tgt = chooseTarget(c);
        if (!tgt.r) { R.balk.nothing++; ev(t, 'balk', { c: c.id, why: 'nothing' }); c.left = true; continue; }
        if (c.budget < tgt.r.m.price) { R.balk.budget++; ev(t, 'balk', { c: c.id, why: 'budget' }); c.left = true; continue; }
        c.doll = tgt.id; c.target = tgt.r;
        tgt.r.queue.push(c);
        customers.push(c);
      }
      // 서비스
      mrt.forEach((r) => {
        if (r.down) { r.queue.forEach((c) => { c.waitFrom = Math.min(c.waitFrom, t); }); }
        else {
          r.acc += 60 / r.def.playSec;
          while (r.acc >= 1 && r.queue.length) { const c = r.queue.shift(); r.acc -= 1; doPlay(r, c, t); }
          if (!r.queue.length) r.acc = Math.min(r.acc, 1);
        }
        // 기다리다 지친 손님
        r.queue = r.queue.filter((c) => {
          if (t - c.waitFrom > c.ct.wait) { if (c.plays === 0) { R.balk.queue++; ev(t, 'balk', { c: c.id, why: 'queue' }); c.left = true; } else leave(c, t, 'queue'); return false; }
          return true;
        });
      });
    }
    // 마감: 남은 손님 퇴장
    mrt.forEach((r) => { r.queue.forEach((c) => { if (c.plays === 0) { R.balk.queue++; c.left = true; } else leave(c, TICKS, 'closing'); }); r.queue = []; });

    // ---- 정산 ----
    R.rent = Math.round(shopLv(st).rent / 30);
    R.upkeep = whLv(st).upkeep;
    mrt.forEach((r) => {
      const pw = r.def.power; R.power += pw;
      R.repair += r.repair;
      R.byMachine.push({ id: r.m.id, type: r.m.type, plays: r.plays, wins: r.wins, revenue: r.rev, payout: Math.round(r.payout), downMin: r.downMin, emptyMin: r.emptyMin, repair: r.repair });
      r.m.age++;
    });
    R.payout = Math.round(R.payout);
    R.cost = R.payout + R.power + R.repair + R.rent + R.upkeep;
    R.profit = R.revenue - R.cost;                                   // 손익(인형은 뽑혀 나간 원가만)
    R.cash = R.revenue - (R.power + R.repair + R.rent + R.upkeep);   // 오늘 현금 증감(인형 매입은 발주할 때 이미 나감)
    st.money += R.cash;
    st.totalRevenue += R.revenue;
    R.avgSat = R.players ? R.satSum / R.players : 0.5;
    // 평판·인기도
    const volume = Math.min(1, R.players / 80);
    const repDelta = (R.avgSat - 0.5) * 6 * volume - R.claims * 0.4 - (R.visitors ? (R.balk.queue + R.balk.empty) / R.visitors * 3 : 0);
    st.reputation = clamp(st.reputation + repDelta, 0, 100);
    R.repDelta = repDelta; R.rep = st.reputation;
    const dayScore = (R.revenue / 20000) * (0.5 + R.avgSat) * (0.6 + st.reputation / 100);
    st.popularity = st.popularity * 0.97 + dayScore;
    R.popularity = st.popularity;
    // 랭크
    while (st.rank < Z.RANK_POP.length && st.popularity >= Z.RANK_POP[st.rank]) { st.rank++; R.rankUp = st.rank; }
    if (st.money < 0) st.bankrupt = true;
    st.history.push({ day: R.day, revenue: R.revenue, profit: R.profit, visitors: R.visitors, rep: Math.round(st.reputation), money: st.money });
    if (st.history.length > 365) st.history.shift();
    if (log) R.log = log;
    st.day++;
    startOfDay(st);
    return R;
  }

  // ---------- 자동 준비(기본 운영 규칙): 계획 세우기 → 부족한 인형 발주 → 기계 채우기 ----------
  // 플레이어가 직접 하는 준비 화면의 "추천"으로도 쓸 수 있다.
  function dollScore(st, d) { // 손님 구성 평균 매력
    let s = 0, w = 0;
    custTypes.forEach((c) => {
      let tagM = 1;
      if (d.tags.length) { let x = 0; d.tags.forEach((t) => { x += c.tagW[t] || 1; }); tagM = x / d.tags.length; }
      s += c.weight * tagM * (c.sizeW[d.size] || 1) * (d.tier === 'limited' ? 1.35 : (d.tier === 'rare' ? 1.2 : 1));
      w += c.weight;
    });
    return (s / w) * trendBoost(st, d);
  }
  function autoPrep(st, o) {
    o = o || {};
    const reserve = o.reserve != null ? o.reserve : 250000;
    const avail = DATA.DOLLS.filter((d) => d.rank <= st.rank);
    const need = {};
    st.machines.forEach((m) => {
      const def = mdef(m);
      const cand = avail.filter((d) => canHold(m, d)).map((d) => ({ d, sc: dollScore(st, d) * (def.sizeAppeal[d.size] || 1) })).sort((a, b) => b.sc - a.sc);
      // 크기별로 골고루: 점수 상위 5종
      const top = cand.slice(0, 5);
      const tsum = top.reduce((s, x) => s + x.sc, 0);
      m.plan = {};
      let used = 0;
      top.forEach((x) => {
        const per = def.slotCost[x.d.size];
        const q = Math.floor((def.slots * x.sc / tsum) / per);
        if (q > 0) { m.plan[x.d.id] = q; used += q * per; }
      });
      // 남은 칸은 점수 순서대로 하나씩 더 채운다(칸이 비지 않게)
      for (let guard = 0; guard < 200; guard++) {
        let placed = false;
        for (const x of top) {
          const per = def.slotCost[x.d.size];
          if (used + per <= def.slots) { m.plan[x.d.id] = (m.plan[x.d.id] || 0) + 1; used += per; placed = true; }
        }
        if (!placed) break;
      }
      Object.keys(m.plan).forEach((id) => { need[id] = (need[id] || 0) + m.plan[id]; });
    });
    // 부족분 발주(보충 여유 50%)
    const items = [];
    let have = stockTotal(st) + incomingTotal(st);
    const loaded = st.machines.reduce((n, m) => n + loadQty(m), 0);
    Object.keys(need).forEach((id) => {
      const inMachines = st.machines.reduce((n, m) => n + (m.load[id] ? m.load[id].qty : 0), 0);
      const inStock = st.stock[id] ? st.stock[id].qty : 0;
      const inc = st.incoming.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);
      const want = Math.ceil(need[id] * 1.5) - inMachines - inStock - inc;
      if (want > 0) items.push({ id, qty: want });
    });
    // 예산: 여유 자금(reserve) 안에서만, 창고 용량 안에서만
    let budget = st.money - reserve, cap = whLv(st).cap - have;
    const buy = [];
    items.forEach((it) => {
      const q = Math.min(it.qty, cap);
      if (q <= 0) return;
      const uc = unitCost(st, it.id, q);
      const aff = Math.min(q, Math.floor(budget / uc));
      if (aff > 0) { buy.push({ id: it.id, qty: aff }); budget -= aff * uc; cap -= aff; }
    });
    if (buy.length) order(st, buy);
    st.machines.forEach((m) => refill(st, m));
    return { ordered: buy };
  }

  return {
    newGame, startOfDay, runDay, forecast, autoPrep,
    buyMachine, sellMachine, expandWarehouse, expandShop, order, unitCost,
    loadMachine, unloadAll, refill, addStock,
    info: { slotsUsed, loadQty, freeSlots, footUsed, stockTotal, incomingTotal, canHold, grabProb: (st, m, d, ct) => grabProb(st, m, d, ct, st.env || {}), doll, TICKS },
  };
})();
