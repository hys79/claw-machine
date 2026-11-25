// 시뮬레이션 코어: 화면(DOM·Canvas)과 무관한 순수 계산. 수치는 CFG.SIM, 데이터는 DATA.DOLLS/MACHINES/CUSTOMERS/EQUIPMENT.
// 하루는 openDay()로 열어 틱(가상 1분) 단위로 진행한다. 영업 화면은 step()으로 사건을 받아 그리고 act()로 플레이어 조작
// (보충·청소·환전·수리)을 넣는다. runDay()/skipDay()는 하루를 한 번에 돌린다.
// 시드 기반 난수라 같은 상태에서 같은 조작을 하면 항상 같은 결과가 나온다.
const Sim = (function () {
  const Z = CFG.SIM;
  const TICKS = (Z.CLOSE - Z.OPEN) * 60;
  const dollMap = {};
  DATA.DOLLS.forEach((d) => { dollMap[d.id] = d; });
  const custTypes = DATA.CUSTOMERS;

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
    r.range = (a2) => a2[0] + r() * (a2[1] - a2[0]);
    return r;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // 오차함수(표준정규의 구간 확률 계산용)
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const round10 = (v) => Math.round(v / 10) * 10;

  // ---------- 조회 ----------
  const doll = (id) => dollMap[id];
  const mdef = (m) => DATA.MACHINES[m.type];
  const shopLv = (st) => Z.SHOP[st.shopLevel];
  const whLv = (st) => Z.WAREHOUSE[st.warehouseLevel];
  const slotsOf = (m) => Math.floor(mdef(m).slots * (m.mods.capacity ? Z.CAPACITY_MULT : 1));
  const slotsUsed = (m) => { const def = mdef(m); let n = 0; Object.keys(m.load).forEach((id) => { n += m.load[id].qty * def.slotCost[doll(id).size]; }); return n; };
  const freeSlots = (m) => slotsOf(m) - slotsUsed(m);
  const loadQty = (m) => { let n = 0; Object.keys(m.load).forEach((id) => { n += m.load[id].qty; }); return n; };
  const loadedIds = (m) => Object.keys(m.load).filter((id) => m.load[id].qty > 0);
  const canHold = (m, d) => mdef(m).sizes.indexOf(d.size) >= 0;
  const placed = (st) => st.machines.filter((m) => !m.stored); // 가게에 설치한 기계(창고에 넣은 것은 제외)
  const placedBins = (st) => st.bins.filter((b) => !b.stored);
  const exchangerOn = (st) => !!st.equip.exchanger && !(st.fix && st.fix.exchanger && st.fix.exchanger.stored);
  const robotOn = (st) => !!st.equip.robot && !(st.fix && st.fix.robot && st.fix.robot.stored);
  const footUsed = (st) => placed(st).reduce((n, m) => n + mdef(m).footprint, 0);
  const stockTotal = (st) => Object.keys(st.stock).reduce((n, id) => n + st.stock[id].qty, 0);
  const incomingTotal = (st) => st.incoming.reduce((n, o) => n + o.qty, 0);
  const dowOf = (day) => (day - 1) % 7; // 0 = 월
  const isShowDay = (day) => day >= Z.SHOW.first && dowOf(day) >= 5;
  const isSpecialDay = (day) => day >= Z.SHOW.special.first && (day - Z.SHOW.special.first) % Z.SHOW.special.every === 0;
  function nextSpecial(day) { // day 이후(당일 포함) 첫 특별 공연일
    const S = Z.SHOW.special;
    return day <= S.first ? S.first : S.first + Math.ceil((day - S.first) / S.every) * S.every;
  }
  // ---------- 날짜 ----------
  // 몇 년차(year), 어느 계절(season 번호·id), 그 계절의 며칠(day)인지
  function calOf(day) {
    const n = Z.SEASON_DAYS, total = Math.floor((day - 1) / n), season = total % 4;
    return { year: Math.floor(total / 4) + 1, season, id: DATA.SEASONS[season].id, day: day - total * n };
  }
  const seasonOf = (day) => calOf(day).id;
  function holidayOf(day) {
    const c = calOf(day);
    return DATA.HOLIDAYS.find((h) => h.season === c.id && h.day === c.day) || null;
  }

  // 동네 행사: 매주 평일(화~금) 하루. 네 주 동안 네 행사가 한 번씩 돌아오고 순서는 가게마다 다르다.
  // 그 취향의 인형을 아직 구할 수 없는 랭크라면 그 주는 쉰다.
  // 날짜 행사가 있는 날은 그것이 동네 행사를 대신한다.
  function eventOf(st, day) {
    const holiday = holidayOf(day);
    if (holiday) return holiday;
    const week = Math.floor((day - 1) / 7) - Z.EVENT.firstWeek, n = DATA.EVENTS.length;
    if (week < 0) return null;
    if (dowOf(day) !== 1 + Math.floor(makeRng(st.seed * 131 + week * 977 + 11)() * 4)) return null;
    const r = makeRng(st.seed * 53 + Math.floor(week / n) * 7919 + 29);
    const order = DATA.EVENTS.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
    const e = DATA.EVENTS[order[week % n]];
    return openTastes(st).indexOf(e.taste) >= 0 ? e : null;
  }
  // 방문객 중 외국인 비율: 공연일에 크게 늘어난다
  function foreignShare(st, day) {
    const F = Z.FOREIGN;
    return (isSpecialDay(day) ? F.special : isShowDay(day) ? F.show : F.share) * (st.equip.globalpay ? F.globalpay : 1);
  }
  // 오늘 인플루언서가 오면 그 시각(틱), 아니면 -1(예고 없이 찾아오므로 화면에는 미리 알리지 않는다)
  function influencerTick(st) {
    const I = Z.INFLUENCER;
    if (st.day < I.first) return -1;
    const r = makeRng(st.seed * 6151 + st.day * 389 + 7);
    r();
    return r() < I.chance ? 30 + Math.floor(r() * (TICKS - 150)) : -1;
  }
  const hasTrend = (st, d) => d.taste.indexOf(st.trend.taste) >= 0;
  // 지금 랭크에서 인형을 구할 수 있는 취향(손님과 유행은 이 안에서만 고른다)
  const openTastes = (st) => DATA.TASTES.filter((t) => DATA.DOLLS.some((d) => d.taste[0] === t && d.rank <= st.rank && !d.special && (!d.locked || (st.unlocked && st.unlocked[d.id]))));
  // 지금 발주할 수 있는 인형(랭크 해금 + 특별 공연 한정은 공연 전 일주일)
  function orderable(st, d) {
    if (d.rank > st.rank) return false;
    if (d.locked && !(st.unlocked && st.unlocked[d.id])) return false; // 도전과제 보상 인형
    if (!d.special) return true;
    const left = nextSpecial(st.day) - st.day;
    return left >= 1 && left <= Z.SHOW.special.lead;
  }

  // ---------- 새 게임 ----------
  // opts.stored: 개업 물품을 창고에 넣고 시작한다(게임). 검증 도구는 설치된 채로 시작한다.
  function newGame(playerName, shopName, seed, opts) {
    const stored = !!(opts && opts.stored);
    const st = {
      v: 2, seed: seed == null ? (Date.now() & 0x7fffffff) : seed, playerName: playerName || '', shopName: shopName || '',
      day: 1, money: CFG.START_MONEY, rank: 1, shopLevel: 0, warehouseLevel: 0, reputation: Z.START_REP, popularity: 0,
      avgRev: null, totalRevenue: 0, machines: [], stock: {}, incoming: [], equip: {}, staff: false,
      trend: { taste: null, next: null, until: 0 }, history: [], nextId: 1,
      rankUpDay: 0, expandDay: 0, champion: false, weather: 'sunny', env: null, bankrupt: false,
    };
    st.bins = [];
    upgradeState(st);
    addMachine(st, 'mini').stored = stored;
    addMachine(st, 'mini').stored = stored;
    addBin(st, false).stored = stored;
    st.tutorial = stored ? 0 : 'done';
    [['chick', 18], ['rocket', 14], ['breadduck', 10], ['oldrobot', 8], ['roundbear', 6], ['berrybunny', 5]].forEach(([id, q]) => addStock(st, id, q, doll(id).cost));
    startOfDay(st);
    return st;
  }

  // 이전 저장에도 새 항목을 채워 준다
  function upgradeState(st) {
    st.decors = st.decors || [];
    st.fix = st.fix || {};
    if (!st.bins) { // 예전 저장: 고정 쓰레기통을 물품으로 바꾼다
      st.bins = [{ uid: st.nextId++, big: !!(st.equip && st.equip.bin), pos: (st.fix.trash && st.fix.trash.pos) || null, stored: false }];
      delete st.fix.trash; if (st.equip) delete st.equip.bin;
    }
    if (st.tutorial === undefined) st.tutorial = 'done';
    if (st.equip && st.equip.exchanger && !st.fix.exchanger) st.fix.exchanger = { pos: (st.fix.exchange && st.fix.exchange.pos) || null, stored: false };
    delete st.fix.exchange; // 붙박이 환전대는 없어졌다(손님에게 직접 가서 바꿔 준다)
    st.ach = st.ach || {};
    st.unlocked = st.unlocked || {};
    st.used = st.used || {};     // 지난 영업일에 뽑혀 나간 인형 수(창고의 '모자랄 인형' 경고)
    st.stats = Object.assign({ days: 0, wins: 0, bestRevenue: 0, fastDays: 0, stockStreak: 0, bestStockStreak: 0, shown: {} }, st.stats);
    // 예전 저장: 없어진 취향(귀여움·우주·레트로)을 지금 취향으로 바꾼다
    if (st.trend && st.trend.taste && (DATA.TASTES.indexOf(st.trend.taste) < 0 || DATA.TASTES.indexOf(st.trend.next) < 0)) {
      const list = openTastes(st);
      if (list.indexOf(st.trend.taste) < 0) st.trend.taste = list[0];
      if (list.indexOf(st.trend.next) < 0 || st.trend.next === st.trend.taste) st.trend.next = list.find((t) => t !== st.trend.taste);
      st.env = null;
    }
    if (st.lastMissed) st.lastMissed = st.lastMissed.filter((t) => DATA.TASTES.indexOf(t) >= 0);
    st.machines.forEach((m) => {
      const ids = loadedIds(m).sort((a, b) => m.load[b].qty - m.load[a].qty);
      if (ids.length <= 1 && Object.keys(m.plan).length <= 1) return;
      ids.slice(1).forEach((id) => { addStock(st, id, m.load[id].qty, m.load[id].cost); delete m.load[id]; });
      const keep = ids[0] || Object.keys(m.plan).sort((a, b) => m.plan[b] - m.plan[a])[0];
      m.plan = keep ? { [keep]: capacityOf(m, keep) } : {};
    });
    return st;
  }

  // ---------- 설치물(창고 ↔ 가게) ----------
  function addBin(st, big) { const b = { uid: st.nextId++, big, pos: null, stored: false }; st.bins.push(b); return b; }
  function canInstall(st, m) {
    return footUsed(st) + mdef(m).footprint <= shopLv(st).slots ? { ok: true } : { ok: false, why: '기계 칸이 모자라요. 가게를 넓히거나 다른 기계를 넣어 주세요' };
  }
  function installMachine(st, id) {
    const m = st.machines.find((x) => x.id === id);
    if (!m || !m.stored) return { ok: false, why: '창고에 없는 기계예요' };
    const c = canInstall(st, m);
    if (c.ok) m.stored = false;
    return c;
  }
  function storeMachine(st, id) { // 안의 인형은 창고로 돌아간다
    const m = st.machines.find((x) => x.id === id);
    if (!m) return { ok: false, why: '없는 기계' };
    unloadAll(st, m); m.stored = true; m.pos = null;
    return { ok: true };
  }
  function sellBin(st, uid) {
    const i = st.bins.findIndex((b) => b.uid === uid);
    if (i < 0) return { ok: false, why: '없는 쓰레기통' };
    if (st.bins.length <= 1) return { ok: false, why: '쓰레기통은 하나 이상 있어야 해요' };
    const gain = Math.round(DATA.EQUIPMENT[st.bins[i].big ? 'bin' : 'smallbin'].price * Z.DECOR.SELL);
    st.bins.splice(i, 1); st.money += gain;
    return { ok: true, gain };
  }
  function sellEquipment(st, key) { // 자동환전기, 로봇 청소기
    if (!st.equip[key]) return { ok: false, why: '없는 설비' };
    const gain = Math.round(DATA.EQUIPMENT[key].price * Z.DECOR.SELL);
    delete st.equip[key]; delete st.fix[key]; st.money += gain;
    return { ok: true, gain };
  }
  // 영업을 시작할 수 있는지: 기계와 쓰레기통이 하나 이상 설치되어 있어야 한다
  function canOpen(st) {
    if (!placed(st).length) return { ok: false, why: '인형뽑기 기계를 하나 이상 설치해 주세요' };
    if (!placedBins(st).length) return { ok: false, why: '쓰레기통을 하나 이상 설치해 주세요' };
    return { ok: true };
  }

  // ---------- 소품 ----------
  const decorDef = (id) => DATA.DECOR.find((d) => d.id === id);
  function charmRaw(st) { // 같은 소품은 두 번째부터 효과가 줄어든다
    const n = {};
    return st.decors.filter((o) => !o.stored).reduce((s, o) => { const d = decorDef(o.id); if (!d) return s; const k = n[o.id] || 0; n[o.id] = k + 1; return s + d.charm * Math.pow(Z.DECOR.DUP, k); }, 0);
  }
  const charmCap = (st) => Z.DECOR.CAP[st.shopLevel];
  const charm = (st) => Math.min(charmRaw(st), charmCap(st)); // 하루 인기도에 실제로 더해지는 값
  function canBuyDecor(st, id) {
    const d = decorDef(id);
    if (!d || d.locked) return { ok: false, why: '살 수 없는 소품이에요' };
    if (d.rank > st.rank) return NO_RANK;
    if (d.champion && !st.champion) return { ok: false, why: '전국 1위를 하면 살 수 있어요' };
    if (st.money < d.price) return NO_MONEY;
    return { ok: true };
  }
  function addDecor(st, id, stored) { const o = { uid: st.nextId++, id, pos: null, stored: !!stored }; st.decors.push(o); return o; }
  function buyDecor(st, id, opts) {
    const c = canBuyDecor(st, id);
    if (!c.ok) return c;
    st.money -= decorDef(id).price;
    return { ok: true, decor: addDecor(st, id, opts && opts.store), cost: decorDef(id).price };
  }
  function sellDecor(st, uid) {
    const i = st.decors.findIndex((o) => o.uid === uid);
    if (i < 0) return { ok: false, why: '없는 소품' };
    const d = decorDef(st.decors[i].id);
    if (d.locked) return { ok: false, why: '기념품은 팔 수 없어요' };
    const gain = Math.round(d.price * Z.DECOR.SELL);
    st.decors.splice(i, 1); st.money += gain;
    return { ok: true, gain };
  }

  // ---------- 창고 ----------
  function sellStock(st, id, qty) {
    const s = st.stock[id];
    if (!s || qty <= 0) return { ok: false, why: '처분할 인형이 없어요' };
    const n = Math.min(qty, s.qty), gain = round10(s.cost * n * Z.STOCK_SELL);
    s.qty -= n; if (s.qty <= 0) delete st.stock[id];
    st.money += gain;
    return { ok: true, gain, qty: n };
  }
  // ---------- 진열 규칙: 기계 하나에는 한 종류의 인형만 ----------
  const planned = (m) => Object.keys(m.plan)[0] || null;                         // 이 기계에 넣기로 한 인형
  const capacityOf = (m, id) => Math.floor(slotsOf(m) / mdef(m).slotCost[doll(id).size]); // 가득 채웠을 때의 수
  const fitsIn = (m, id) => canHold(m, doll(id)) && capacityOf(m, id) > 0;
  const qtyIn = (m, id) => (m.load[id] ? m.load[id].qty : 0);
  // 정한 인형이 없을 때 대신 넣을 수 있는 창고 인형(직접 정한 진열은 같은 크기·취향만). 비슷하고 많이 채울 수 있는 것부터
  function substitutes(st, m) {
    const p = planned(m);
    if (m.manual && !p) return [];
    const near = (id) => (p && similar(doll(p), doll(id)) ? 1 : 0);
    return Object.keys(st.stock).filter((id) => id !== p && st.stock[id].qty > 0 && fitsIn(m, id) && (!m.manual || near(id)))
      .sort((a, b) => near(b) - near(a) || Math.min(st.stock[b].qty, capacityOf(m, b)) - Math.min(st.stock[a].qty, capacityOf(m, a)));
  }
  function canRefill(st, m) {
    const p = planned(m), cur = loadedIds(m)[0];
    const room = (id) => freeSlots(m) >= mdef(m).slotCost[doll(id).size];
    if (p && st.stock[p] && fitsIn(m, p) && (cur !== p || (qtyIn(m, p) < m.plan[p] && room(p)))) return true;
    if (!cur) return substitutes(st, m).length > 0;
    return cur !== p && !!st.stock[cur] && room(cur) && (!m.manual || qtyIn(m, cur) < (m.plan[p] || 0));
  }
  const similar = (a, b) => a.size === b.size && a.taste.some((t) => b.taste.indexOf(t) >= 0); // 대신 채울 수 있는 인형

  // ---------- 도전과제 ----------
  function statValue(st, key, live) {
    const s = st.stats;
    if (key === 'rank') return st.rank;
    if (key === 'champion') return st.champion ? 1 : 0;
    if (key === 'totalRevenue') return st.totalRevenue + (live ? live.revenue : 0);
    if (key === 'wins') return s.wins + (live ? live.wins : 0);
    if (key === 'bestRevenue') return Math.max(s.bestRevenue, live ? live.revenue : 0);
    if (key === 'dollKinds') return Object.keys(s.shown).length;
    if (key === 'machineKinds') return new Set(st.machines.map((m) => m.type)).size;
    if (key === 'decorCount') return st.decors.filter((o) => !o.stored).length;
    if (key === 'charm') return charmRaw(st);
    if (key === 'statue') return st.decors.some((o) => o.id === 'goldstatue' && !o.stored) ? 1 : 0;
    return s[key] || 0;
  }
  // 새로 달성한 도전과제를 돌려주고 보상을 지급한다. live: 영업 중이면 그날의 진행 결과
  function checkAchievements(st, live) {
    const out = [];
    DATA.ACHIEVEMENTS.forEach((a) => {
      if (st.ach[a.id] || statValue(st, a.stat, live) < a.goal) return;
      st.ach[a.id] = st.day;
      const r = a.reward;
      if (r.money) st.money += r.money;
      if (r.doll) st.unlocked[r.doll] = true;
      if (r.decor) addDecor(st, r.decor, true); // 보상 소품은 창고로
      out.push(a);
    });
    return out;
  }

  function addMachine(st, type) {
    const m = { id: st.nextId++, type, difficulty: 3, price: DATA.MACHINES[type].priceDef, plan: {}, load: {}, mods: {}, age: 0 };
    st.machines.push(m);
    return m;
  }

  // ---------- 재고(이동 평균 원가) ----------
  function addStock(st, id, qty, unitCost) {
    const s = st.stock[id] || (st.stock[id] = { qty: 0, cost: unitCost });
    s.cost = (s.cost * s.qty + unitCost * qty) / (s.qty + qty);
    s.qty += qty;
  }

  // ---------- 구매 / 확장 / 직원 ----------
  function pay(st, cost) { if (st.money < cost) return false; st.money -= cost; return true; }
  const NO_MONEY = { ok: false, why: '돈이 부족해요' };
  const NO_RANK = { ok: false, why: '가게 랭크가 더 필요해요' };

  function buyMachine(st, type, opts) {
    const store = !!(opts && opts.store);
    const def = DATA.MACHINES[type];
    if (!def) return { ok: false, why: '없는 기계' };
    if (def.rank > st.rank) return NO_RANK;
    if (!store && footUsed(st) + def.footprint > shopLv(st).slots) return { ok: false, why: '점포에 자리가 없어요' };
    if (!pay(st, def.price)) return NO_MONEY;
    const m = addMachine(st, type); m.stored = store;
    return { ok: true, machine: m, cost: def.price };
  }
  // 기계 팔기: 구입가의 40%(중고). 안의 인형은 창고로 돌아간다.
  function sellMachine(st, id) {
    const i = st.machines.findIndex((m) => m.id === id);
    if (i < 0) return { ok: false, why: '없는 기계' };
    if (st.machines.length <= 1) return { ok: false, why: '기계는 한 대 이상 있어야 해요' };
    unloadAll(st, st.machines[i]);
    const gain = Math.round(mdef(st.machines[i]).price * 0.4);
    st.machines.splice(i, 1);
    st.money += gain;
    return { ok: true, gain };
  }
  // 설비: 가게 전체 설비는 key만, 기계 개조(perMachine)는 machineId도 준다.
  function buyEquipment(st, key, machineId, opts) {
    const e = DATA.EQUIPMENT[key];
    if (!e) return { ok: false, why: '없는 설비' };
    if (e.rank > st.rank) return NO_RANK;
    if (key === 'bin' || key === 'smallbin') { // 쓰레기통은 여러 개 놓을 수 있는 물품
      if (!pay(st, e.price)) return NO_MONEY;
      addBin(st, key === 'bin').stored = !!(opts && opts.store);
      return { ok: true, cost: e.price };
    }
    if (e.perMachine) {
      const m = st.machines.find((x) => x.id === machineId);
      if (!m) return { ok: false, why: '기계를 골라 주세요' };
      if (m.mods[key]) return { ok: false, why: '이미 개조했어요' };
      if (key === 'capacity' && mdef(m).kind === 'timer') return { ok: false, why: '타이머 기계는 개조할 수 없어요' };
      if (!pay(st, e.price)) return NO_MONEY;
      m.mods[key] = true;
    } else {
      if (st.equip[key]) return { ok: false, why: '이미 있어요' };
      if (!pay(st, e.price)) return NO_MONEY;
      st.equip[key] = true;
      if (key === 'robot' || key === 'exchanger') st.fix[key] = { pos: null, stored: !!(opts && opts.store) }; // 가게에 놓는 설비
    }
    return { ok: true, cost: e.price };
  }
  function expandWarehouse(st) {
    const next = Z.WAREHOUSE[st.warehouseLevel + 1];
    if (!next) return { ok: false, why: '최대 단계예요' };
    if (!pay(st, next.cost)) return NO_MONEY;
    st.warehouseLevel++;
    return { ok: true, cost: next.cost };
  }
  function expandShop(st) {
    const next = Z.SHOP[st.shopLevel + 1];
    if (!next) return { ok: false, why: '최대 단계예요' };
    if (st.rank < next.rank) return NO_RANK;
    if (!pay(st, next.cost)) return NO_MONEY;
    st.shopLevel++;
    st.expandDay = st.day; // 확장 후 첫 영업일은 건너뛸 수 없다
    return { ok: true, cost: next.cost };
  }
  function hireStaff(st) {
    if (st.staff) return { ok: false, why: '이미 직원이 있어요' };
    if (st.rank < Z.STAFF.rank) return NO_RANK;
    st.staff = true;
    return { ok: true, wage: Z.STAFF.wage };
  }
  // 기계 설정(난이도 1~5, 한 판 가격). scope: 'one' 이 기계만 / 'type' 같은 종류 전체 / 'all' 가게 전체
  function setOption(st, machineId, key, value, scope) {
    const base = st.machines.find((m) => m.id === machineId);
    if (!base || (key !== 'difficulty' && key !== 'price')) return { ok: false, why: '바꿀 수 없어요' };
    const list = st.machines.filter((m) => (scope === 'all' ? true : (scope === 'type' ? m.type === base.type : m === base)));
    list.forEach((m) => {
      if (key === 'difficulty') m.difficulty = clamp(Math.round(value), 1, 5);
      else m.price = clamp(round10(value), mdef(m).priceRange[0], mdef(m).priceRange[1]);
    });
    return { ok: true, count: list.length };
  }

  // ---------- 발주 ----------
  function unitCost(st, id, qty) {
    const d = doll(id);
    let c = d.cost * (hasTrend(st, d) ? Z.TREND.price : 1);
    for (let i = 0; i < Z.BULK.length; i++) if (qty >= Z.BULK[i][0]) { c *= 1 - Z.BULK[i][1]; break; }
    return round10(c);
  }
  // items: [{id, qty}]. 하루를 마친 뒤 주문하면 다음 영업일 아침(openDay)에 들어온다. 창고 용량(재고 + 입고 예정)을 넘으면 발주할 수 없다.
  function order(st, items) {
    let qty = 0, cost = 0;
    const lines = [];
    for (const it of items) {
      const d = doll(it.id);
      if (!d || it.qty <= 0) continue;
      if (!orderable(st, d)) return { ok: false, why: d.name + '은(는) 지금 주문할 수 없어요' };
      const uc = unitCost(st, it.id, it.qty);
      lines.push({ id: it.id, qty: it.qty, unit: uc });
      qty += it.qty; cost += uc * it.qty;
    }
    if (!qty) return { ok: false, why: '주문할 인형이 없어요' };
    if (stockTotal(st) + incomingTotal(st) + qty > whLv(st).cap) return { ok: false, why: '창고 공간이 부족해요' };
    if (!pay(st, cost)) return NO_MONEY;
    lines.forEach((l) => st.incoming.push({ id: l.id, qty: l.qty, unit: l.unit, arrive: st.day })); // 다음 영업일 아침에 들어온다
    return { ok: true, cost, qty };
  }

  // ---------- 기계 채우기 ----------
  function loadMachine(st, m, id, qty) {
    const d = doll(id), s = st.stock[id];
    if (!d || !s || !canHold(m, d) || loadedIds(m).some((x) => x !== id)) return 0; // 다른 인형이 든 기계에는 못 넣는다
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
  // 보충: 정한 인형(plan)으로 채운다. 기계가 비었는데 그 인형이 없으면 다른 인형 하나를 대신 넣고,
  // 대신 넣은 뒤에 정한 인형이 창고에 들어오면 다시 바꿔 넣는다.
  function refill(st, m, subs) {
    const p = planned(m);
    if (p && st.stock[p] && fitsIn(m, p) && loadedIds(m).some((id) => id !== p)) unloadAll(st, m);
    let n = p ? loadMachine(st, m, p, m.plan[p] - qtyIn(m, p)) : 0;
    const cur = loadedIds(m)[0];
    const goal = (id) => (m.manual ? m.plan[p] || 0 : capacityOf(m, id)) - qtyIn(m, id);
    if (cur && cur !== p) n += loadMachine(st, m, cur, goal(cur));
    else if (!cur) {
      const id = substitutes(st, m)[0];
      if (id) { const k = loadMachine(st, m, id, goal(id)); n += k; if (k && p && subs) subs.push(id); }
    }
    return n;
  }
  // 놓인 기계 전부: 먼저 모두 정한 인형을 넣고(대신 넣느라 남의 인형을 가져가지 않게) 나머지를 마저 채운다
  function refillAll(st) {
    placed(st).forEach((m) => {
      const p = planned(m);
      if (!p || !st.stock[p] || !fitsIn(m, p)) return;
      if (loadedIds(m).some((id) => id !== p)) unloadAll(st, m);
      loadMachine(st, m, p, m.plan[p] - qtyIn(m, p));
    });
    placed(st).forEach((m) => refill(st, m));
  }

  // ---------- 취향과 확률 ----------
  // 손님이 인형에 끌리는 정도: 2 가장 좋아함 / 1 즐김 / 0 관심 없음
  const affinity = (c, d) => (d.taste.indexOf(c.tastes[0]) >= 0 ? 2 : c.cat.likesOthers || d.taste.some((t) => c.also.indexOf(t) >= 0) ? 1 : 0);
  function grabProb(m, d, skill) {
    const def = mdef(m);
    if (def.kind === 'timer') { // 정확한 시간에 버튼 누르기: 버튼 오차 ~ 정규분포(숙련될수록 작다), 허용 오차 안이면 성공
      return erf(def.tolerance[m.difficulty - 1] / ((def.sigma / skill) * Math.SQRT2));
    }
    const base = def.grab[d.size];
    if (!base) return 0;
    return clamp(base * Z.STRENGTH[m.difficulty - 1] * (1 - d.hard * 0.4) * skill, 0, 0.6);
  }

  // ---------- 하루의 시작 ----------
  function deliver(st) { // 입고
    const n = st.incoming.length;
    st.incoming = st.incoming.filter((o) => {
      if (o.arrive <= st.day) { addStock(st, o.id, o.qty, o.unit); return false; }
      return true;
    });
    return n - st.incoming.length;
  }
  function startOfDay(st) {
    const rng = makeRng(st.seed * 7919 + st.day * 31 + 5);
    // 유행 취향: 매주 바뀌고 다음 유행을 미리 알려 준다
    if (st.day >= st.trend.until || !st.trend.taste) {
      const pickT = (not) => { const list = openTastes(st).filter((t) => t !== not); return list[Math.floor(rng() * list.length)]; };
      const taste = st.trend.next || pickT(null);
      st.trend = { taste, next: pickT(taste), until: st.day + Z.TREND.days };
    }
    const odds = Z.WEATHER_SEASON[calOf(st.day).season];
    const w = rng.pickW(['sunny', 'cloudy', 'rain', 'snow', 'heat'], odds);
    st.weather = w;
    st.env = { weather: w, weatherMult: Z.WEATHER_MULT[w], show: isShowDay(st.day), special: isSpecialDay(st.day), dow: dowOf(st.day) };
    return st.env;
  }

  // 오늘 예상 방문객
  function repMult(st) { return Z.REP_MULT[0] + (Z.REP_MULT[1] - Z.REP_MULT[0]) * (st.reputation / 100); }
  function expectedVisitors(st, env) {
    const showMult = env.special ? Z.SHOW.special.dayMult : (env.show ? Z.SHOW.dayMult : 1);
    const event = eventOf(st, st.day), eventMult = event ? event.dayMult || Z.EVENT.dayMult : 1;
    return Z.BASE_VISITORS * Z.DOW[env.dow] * env.weatherMult * repMult(st) * shopLv(st).foot * (0.5 + 0.5 * machineVariety(st)) * eyeCatch(st) * showMult * eventMult;
  }
  function forecast(st) { return Math.round(expectedVisitors(st, st.env || startOfDay(st))); }
  // 초대형 인형을 채운 기계가 있으면 지나가던 사람이 들어온다(기계당 +8%, 최대 +16%)
  function eyeCatch(st) {
    let n = 0;
    placed(st).forEach((m) => { loadedIds(m).forEach((id) => { if (doll(id).size === 'XL') n++; }); });
    return 1 + Math.min(n, 2) * 0.08;
  }
  // 기계/인형이 다양할수록(최대 1) 손님이 많이 들어온다
  function machineVariety(st) {
    const types = {}, dolls = {};
    placed(st).forEach((m) => { loadedIds(m).forEach((id) => { types[m.type] = 1; dolls[id] = 1; }); });
    return clamp((Object.keys(dolls).length / 8) * 0.7 + (Object.keys(types).length / 3) * 0.3, 0.15, 1);
  }

  // ---------- 하루 영업 ----------
  // mode: 'manual'(화면에서 act로 처리) / 'bot'(직접 운영 검증용) / 'staff'(건너뛴 날의 직원) / 'none'(방치)
  function openDay(st, opts) {
    opts = opts || {};
    const mode = opts.mode || 'manual';
    let delay = mode === 'manual' ? Infinity : Z.RESPOND[mode];
    const env = st.env || startOfDay(st);
    upgradeState(st);
    if (deliver(st)) refillAll(st); // 아침 입고분을 진열한다
    upgradeState(st);
    placed(st).forEach((m) => loadedIds(m).forEach((id) => { st.stats.shown[id] = 1; }));
    const rng = makeRng(st.seed * 1000003 + st.day * 17 + 3);
    let events = [];
    const ev = (type, o) => { events.push(Object.assign({ t, type }, o)); };

    const R = {
      day: st.day, weather: env.weather, show: env.show, special: env.special, event: null, foreign: 0, influencer: null,
      visitors: 0, players: 0, plays: 0, wins: 0, claims: 0, dirty: 0,
      balk: { nothing: 0, budget: 0, queue: 0, empty: 0, exchange: 0 }, missed: {},
      revenue: 0, payout: 0, power: 0, repair: 0, rent: 0, upkeep: 0, wage: 0, satSum: 0,
      tasks: { refill: 0, clean: 0, exchange: 0, repair: 0 },
      lateTasks: 0, used: {}, achieved: [], byMachine: [], byType: {}, hourly: new Array(Z.CLOSE - Z.OPEN).fill(0),
    };
    custTypes.forEach((c) => { R.byType[c.id] = { visitors: 0, plays: 0, revenue: 0 }; });
    DATA.TASTES.forEach((x) => { R.missed[x] = 0; });

    const mrt = placed(st).map((m) => {
      const def = mdef(m);
      const pb = clamp(Z.BREAK_BASE + m.age * Z.BREAK_AGE, 0, Z.BREAK_MAX) * (m.mods.durable ? Z.DURABLE_MULT : 1);
      const brk = rng() < pb ? Math.floor(rng() * (TICKS - 60)) + 30 : -1;
      return { m, def, queue: [], acc: 0, down: false, brokeAt: -1, breakAt: brk, refillWait: 0, plays: 0, wins: 0, rev: 0, payout: 0, downMin: 0, emptyMin: 0, repair: 0 };
    });
    const byId = {};
    mrt.forEach((r) => { byId[r.m.id] = r; });

    const showFrom = Z.SHOW.from, showTo = Z.SHOW.to;
    const showHour = env.special ? Z.SHOW.special.mult : (env.show ? Z.SHOW.mult : 1);
    const event = eventOf(st, st.day), vipAt = influencerTick(st);
    R.event = event ? event.id : null;
    const hourMult = (h) => Z.HOUR_W[h - Z.OPEN] * (h >= showFrom && h < showTo ? showHour : 1) * (event && event.hours && h >= event.hours[0] && h < event.hours[1] ? Z.EVENT.mult : 1);
    const visitorsToday = expectedVisitors(st, env);
    let wsum = 0; for (let h = Z.OPEN; h < Z.CLOSE; h++) wsum += hourMult(h);
    R.expected = Math.round(visitorsToday);

    let t = 0, cid = 0, litter = 0, report = null;
    let tasks = [];          // 처리할 일: {type, m(기계 번호 또는 null), t(생긴 시각)}
    let waiting = [];        // 환전을 기다리는 손님

    // 쓰레기통이 담는 양: 놓은 쓰레기통이 많고 클수록 청소할 일이 늦게 생긴다
    const litterLimit = Z.LITTER.task * Math.max(1, placedBins(st).reduce((s, b) => s + (b.big ? Z.LITTER.binMult : 1), 0));
    const findTask = (type, mid) => tasks.find((k) => k.type === type && k.m === mid);
    function addTask(type, mid) {
      if (findTask(type, mid)) return;
      tasks.push({ type, m: mid, t });
      R.tasks[type]++;
      ev('task', { task: type, m: mid });
    }
    const dropTask = (type, mid) => { tasks = tasks.filter((k) => !(k.type === type && k.m === mid)); };

    // 플레이어(또는 직원) 조작
    function act(type, mid, costMult) {
      const k = findTask(type, mid == null ? null : mid);
      if (type === 'refill') {
        const r = byId[mid];
        if (!r) return false;
        const subs = [], n = refill(st, r.m, subs);
        if (!n) { if (mode !== 'manual') { dropTask(type, mid); r.refillWait = t + 60; } return false; } // 창고에 채울 인형이 없다
        if (k && t - k.t > Z.FAST_TASK) R.lateTasks++;
        dropTask(type, mid);
        loadedIds(r.m).forEach((id) => { st.stats.shown[id] = 1; });
        ev('refill', { m: mid, n, subs });
        return true;
      }
      if (!k) return false;
      if (t - k.t > Z.FAST_TASK) R.lateTasks++;
      if (type === 'clean') { litter = 0; }
      else if (type === 'exchange') { const c = waiting.find((w) => w.id === mid); if (c) join(c); waiting = waiting.filter((w) => w !== c); } // 환전은 손님 한 명씩
      else if (type === 'repair') {
        const r = byId[mid];
        r.down = false; r.repair += Math.round(r.def.repair * (costMult || 1));
        ev('repaired', { m: mid });
      }
      dropTask(type, k.m);
      ev('done', { task: type, m: k.m });
      return true;
    }

    // 바닥의 쓰레기 하나를 줍는다(청소할 일이 있어도 기준 아래로 줄면 해결된다)
    function pickLitter() {
      if (litter > 0) litter--;
      const k = findTask('clean', null);
      if (k && litter < litterLimit) { if (t - k.t > Z.FAST_TASK) R.lateTasks++; dropTask('clean', null); }
      return litter;
    }

    function pickCategory(h, foreign) {
      const weekend = env.dow >= 5;
      let list = custTypes.filter((c) => c.rank <= st.rank);
      if (foreign) { // 외국인은 높은 확률로 K-pop 팬이다
        const kpop = list.find((c) => c.id === 'kpop');
        if (kpop && rng() < Z.FOREIGN.kpop) return kpop;
        list = list.filter((c) => c.id !== 'kpop');
      }
      const ws = list.map((c) => {
        const tm = c.time;
        let w = c.weight * (h >= tm.hours[0] && h < tm.hours[1] ? tm.mult : tm.off);
        if (weekend) w *= tm.weekend;
        if (env.show || env.special) w *= tm.show * (env.special && tm.show > 1 ? 1.4 : 1);
        if (event && event.category === c.id) w *= Z.EVENT.category;
        return w;
      });
      return rng.pickW(list, ws);
    }
    const open = openTastes(st);
    function pickTastes(cat) { // 손님 한 명의 가장 좋아하는 취향(배열로 담는다)
      const list = Object.keys(cat.tastes).filter((x) => open.indexOf(x) >= 0);
      if (!list.length) return [rng.pickW(open, open.map(() => 1))];
      return [rng.pickW(list, list.map((x) => cat.tastes[x] * (x === st.trend.taste ? Z.TREND.demand : 1) * (event && x === event.taste ? Z.EVENT.demand : 1)))];
    }

    function pickAlso(cat, fav) { // 가장 좋아하는 것 말고 무작위로 즐기는 취향
      const rest = open.filter((x) => x !== fav), out = [];
      while (out.length < (cat.extraLikes || 0) && rest.length) out.push(rest.splice(rng.pickW(rest.map((_, i) => i), rest.map(() => 1)), 1)[0]);
      return out;
    }

    const dollAppeal = (c, d, m) => Z.MATCH.appeal[affinity(c, d)] * (hasTrend(st, d) ? Z.TREND.appeal : 1) * (mdef(m).sizeAppeal[d.size] || 1);

    function chooseTarget(c) {
      let best = 0, bestMatch = 0; const cand = []; const seen = {};
      mrt.forEach((r) => {
        const pf = clamp(r.def.ref / r.m.price, 0.5, 1.8), qpen = 1 / (1 + 0.12 * r.queue.length);
        loadedIds(r.m).forEach((id) => {
          const d = doll(id);
          d.taste.forEach((x) => { seen[x] = 1; });
          if (r.down) return;
          const sc = dollAppeal(c, d, r.m) * r.def.appeal * pf * qpen;
          cand.push({ r, id, sc });
          bestMatch = Math.max(bestMatch, affinity(c, d));
          if (sc > best) best = sc;
        });
      });
      c.tastes.forEach((x) => { if (!seen[x]) R.missed[x]++; }); // 가장 좋아하는데 가게에 없던 취향
      if (!cand.length) return null;
      if (bestMatch === 0) {
        if (rng() < Z.MATCH.leave) return null;
        c.maxPlays = 1 + Math.floor(rng() * Z.MATCH.noneMaxPlays);
      } else if (rng() > (best * best) / (best * best + Z.CONV_K * Z.CONV_K)) return null;
      return rng.pickW(cand, cand.map((o) => o.sc * o.sc));
    }

    function join(c) { c.waitFrom = t; c.target.queue.push(c); }

    // 인플루언서의 평: 놀고 간 경험 + 들어왔을 때의 가게 상태(좋아하는 인형, 청결, 고장·빈 기계). -1 ~ 1
    function review(c) {
      const v = c.seen, I = Z.INFLUENCER;
      let score = c.plays ? 0.2 + (clamp(c.sat, 0, 1) - 0.5) * 0.8 + (c.wins ? 0.4 : 0) : -0.7;
      score = clamp(score + (v.fav ? 0.3 : 0) - (v.dirty ? 0.5 : 0) - (v.trouble ? 0.4 : 0), -1, 1);
      const points = score * Math.max(I.minGain, st.popularity * I.gain) * (score < 0 ? I.badMult : 1);
      R.influencer = { score, points };
      ev('review', { c: c.id, good: score >= 0, points });
    }

    function leave(c, why) {
      if (c.vip) review(c);
      if (c.plays === 0) { if (R.balk[why] != null) R.balk[why]++; ev('balk', { c: c.id, why }); return; }
      R.players++;
      if (why === 'frustrated') c.sat -= 0.1;
      c.sat = clamp(c.sat, 0, 1);
      R.satSum += c.sat;
      if (c.sat < 0.2 && rng() < 0.35) { R.claims++; ev('claim', { c: c.id }); }
      if (rng() < Z.LITTER.chance * (robotOn(st) ? Z.LITTER.robotKeep : 1)) {
        litter++;
        ev('litter', { c: c.id });
        if (litter >= litterLimit) addTask('clean', null);
      }
      ev('leave', { c: c.id, why, plays: c.plays, wins: c.wins, spent: c.spent });
    }

    function doPlay(r, c) {
      const m = r.m;
      // 원하던 인형이 없으면 남은 인형 중에서 다시 고른다
      if (!m.load[c.doll] || m.load[c.doll].qty <= 0) {
        const ids = loadedIds(m);
        if (!ids.length) { leave(c, 'empty'); return; }
        c.doll = rng.pickW(ids, ids.map((id) => Math.pow(dollAppeal(c, doll(id), m), 2)));
      }
      const d = doll(c.doll), match = affinity(c, d);
      // 가장 좋아하는 인형에는 돈을 더 쓴다
      if (match === 2 && !c.boosted) { c.boosted = true; c.budget = Math.round(c.budget * Z.MATCH.favBudget / 100) * 100; }
      // 인기 인형(가장 좋아하거나, 즐기는 것 중 유행·희귀)은 어려워도 도전한다
      const popular = match === 2 || (match === 1 && (hasTrend(st, d) || d.taste.indexOf('희귀') >= 0));
      c.budget -= m.price; c.spent += m.price; c.plays++;
      R.plays++; R.revenue += m.price; r.plays++; r.rev += m.price;
      R.byType[c.cat.id].plays++; R.byType[c.cat.id].revenue += m.price;
      R.hourly[Math.min(R.hourly.length - 1, Math.floor(t / 60))] += m.price;
      const won = rng() < grabProb(m, d, c.skill);
      const near = !won && rng() < 0.45;
      if (won) {
        c.wins++; R.wins++; r.wins++;
        R.used[d.id] = (R.used[d.id] || 0) + 1;
        const l = m.load[c.doll];
        R.payout += l.cost; r.payout += l.cost;
        l.qty--; if (l.qty <= 0) delete m.load[c.doll];
        ev('win', { c: c.id, m: m.id, doll: d.id, cat: c.cat.id });
        c.sat += 0.33 + match * Z.MATCH.satWin; c.fails = 0;
      } else {
        ev('play', { c: c.id, m: m.id, near, cat: c.cat.id });
        const harsh = popular ? 0.6 : 1 + (m.difficulty - 3) * 0.3; // 평범한 인형은 어려울수록 불만이 크다
        c.sat += 0.03 - (near ? 0.04 : 0.07) * harsh; c.fails++;
      }
      const bonus = (match === 2 ? Z.MATCH.extraTry : 0) + (popular ? 0.06 : 0);
      let cont;
      if (c.budget < m.price || c.plays >= c.maxPlays) cont = false;
      else if (won) cont = rng() < Z.CUSTOMER.win + bonus;
      else cont = rng() < clamp(1 - c.fails / (c.patience + 1) + (near ? 0.15 : 0) + bonus, 0, 0.95);
      if (!cont) { leave(c, c.budget < m.price ? 'budget' : (won ? 'happy' : 'frustrated')); return; }
      join(c); // 계속: 다시 줄 끝에 선다(줄이 없으면 바로 이어서 한다)
    }

    function arrive(h, force, vip) { // force: 개발자 모드에서 환전 손님을 바로 만든다 / vip: 인플루언서
      const foreign = !vip && rng() < foreignShare(st, st.day);
      const cat = vip ? custTypes[0] : pickCategory(h, foreign), C = Z.CUSTOMER;
      const c = {
        id: ++cid, cat, foreign, vip: !!vip, tastes: pickTastes(cat),
        budget: Math.max(500, Math.round(C.BUDGET_AVG * Math.exp(rng.normal() * C.BUDGET_SPREAD) / 100) * 100),
        patience: Math.round(rng.range(C.patience)), wait: rng.range(C.wait), skill: rng.range(C.skill),
        sat: 0.55, fails: 0, plays: 0, wins: 0, spent: 0, maxPlays: 999, waitFrom: t,
      };
      c.also = pickAlso(cat, c.tastes[0]);
      R.visitors++; R.byType[cat.id].visitors++;
      if (foreign) R.foreign++;
      if (vip) {
        c.budget = Math.round(c.budget * Z.INFLUENCER.budget / 100) * 100;
        c.seen = {
          dirty: !!findTask('clean', null),
          trouble: mrt.some((r) => r.down || slotsUsed(r.m) === 0),
          fav: mrt.some((r) => !r.down && loadedIds(r.m).some((id) => affinity(c, doll(id)) === 2)),
        };
      }
      ev('arrive', { c: c.id, cat: cat.id, tastes: c.tastes, foreign, vip: c.vip });
      if (findTask('clean', null)) { c.sat -= Z.LITTER.sat; R.dirty++; }
      const tgt = chooseTarget(c) || (force && mrt.length ? { r: mrt[0], id: null } : null);
      if (!tgt) { leave(c, 'nothing'); return; }
      if (!force && c.budget < tgt.r.m.price) { leave(c, 'budget'); return; }
      c.doll = tgt.id; c.target = tgt.r;
      // 환전이 필요한 손님은 처리해 줄 때까지 기다린다
      let ex = Z.EXCHANGE.chance * (exchangerOn(st) ? Z.EXCHANGE.exchangerKeep : 1);
      if (st.equip.globalpay && foreign) ex = 0;
      if (force || rng() < ex) { waiting.push(c); ev('exchange', { c: c.id }); addTask('exchange', c.id); return; }
      join(c);
    }

    // 개발자 모드(플레이 테스트)용: 원하는 상황을 바로 만든다
    function debug(kind) {
      if (kind === 'auto') delay = delay === Infinity ? 1 : Infinity;
      else if (kind === 'break') { const r = mrt.find((x) => !x.down); if (r) { r.down = true; r.brokeAt = t; addTask('repair', r.m.id); ev('breakdown', { m: r.m.id }); } }
      else if (kind === 'litter') { for (let i = 0; i < litterLimit; i++) { litter++; ev('litter', { c: -1 - i }); } addTask('clean', null); }
      else if (kind === 'exchange') arrive(Z.OPEN + Math.floor(Math.min(t, TICKS - 1) / 60), true);
      else if (kind === 'influencer') arrive(Z.OPEN + Math.floor(Math.min(t, TICKS - 1) / 60), false, true);
      else if (kind === 'empty') { const r = mrt.find((x) => loadQty(x.m) > 0); if (r) { unloadAll(st, r.m); r.refillWait = 0; } }
      return delay !== Infinity;
    }

    function tick() {
      const h = Z.OPEN + Math.floor(t / 60);
      mrt.forEach((r) => {
        if (r.breakAt === t) { r.down = true; r.brokeAt = t; addTask('repair', r.m.id); ev('breakdown', { m: r.m.id }); }
        if (r.down && t - r.brokeAt >= Z.TECHNICIAN.delay && !(findTask('repair', r.m.id) || {}).claimed) act('repair', r.m.id, Z.TECHNICIAN.cost); // 오래 두면 기사를 부른다
        if (r.down) r.downMin++;
        const used = slotsUsed(r.m);
        if (used === 0) r.emptyMin++;
        if (used <= slotsOf(r.m) * Z.REFILL_AT && t >= r.refillWait) {
          // 창고에 채울 인형이 없어도 알려 준다(자동 처리 방식은 채울 수 있을 때만)
          if (mode === 'manual' || canRefill(st, r.m)) addTask('refill', r.m.id);
        }
      });
      // 자동 처리(직원·검증용)
      tasks.slice().forEach((k) => { if (t - k.t >= delay) act(k.type, k.m); });
      const n = rng.poisson(visitorsToday * (hourMult(h) / wsum) / 60);
      for (let i = 0; i < n; i++) arrive(h);
      if (t === vipAt) arrive(h, false, true);
      // 환전을 기다리다 나가는 손님
      waiting = waiting.filter((c) => {
        if ((findTask('exchange', c.id) || {}).claimed || t - c.waitFrom <= Z.EXCHANGE.wait) return true; // 사장님이 가고 있으면 기다린다
        dropTask('exchange', c.id); leave(c, 'exchange'); return false;
      });
      // 기계 이용
      mrt.forEach((r) => {
        if (r.down) r.queue.forEach((c) => { c.waitFrom = Math.min(c.waitFrom, t); });
        else {
          r.acc += 60 / r.def.playSec;
          while (r.acc >= 1 && r.queue.length) { const c = r.queue.shift(); r.acc -= 1; doPlay(r, c); }
          if (!r.queue.length) r.acc = Math.min(r.acc, 1);
        }
        r.queue = r.queue.filter((c) => { if (t - c.waitFrom > c.wait) { leave(c, 'queue'); return false; } return true; });
      });
      t++;
    }

    // 영업을 n분 진행하고 그동안의 사건을 돌려준다.
    function step(n) {
      events = [];
      for (let i = 0; i < (n || 1) && t < TICKS; i++) tick();
      return events;
    }

    // 마감과 정산(남은 시간이 있으면 마저 돌린다)
    function close() {
      if (report) return report;
      while (t < TICKS) step(60);
      waiting.forEach((c) => leave(c, 'queue')); waiting = [];
      mrt.forEach((r) => { r.queue.forEach((c) => leave(c, c.plays ? 'closing' : 'queue')); r.queue = []; });
      R.rent = Math.round(shopLv(st).rent / 30);
      R.upkeep = whLv(st).upkeep;
      R.wage = st.staff ? Z.STAFF.wage : 0;
      mrt.forEach((r) => {
        R.power += r.def.power;
        R.repair += r.repair;
        R.byMachine.push({ id: r.m.id, type: r.m.type, plays: r.plays, wins: r.wins, revenue: r.rev, payout: Math.round(r.payout), downMin: r.downMin, emptyMin: r.emptyMin, repair: r.repair });
        r.m.age++;
      });
      R.payout = Math.round(R.payout);
      const fixed = R.power + R.repair + R.rent + R.upkeep + R.wage;
      R.cost = R.payout + fixed;
      R.profit = R.revenue - R.cost;   // 손익(인형은 뽑혀 나간 원가만)
      R.cash = R.revenue - fixed;      // 오늘 현금 증감(인형 매입은 발주할 때 이미 나감)
      st.money += R.cash;
      st.totalRevenue += R.revenue;
      R.avgSat = R.players ? R.satSum / R.players : 0.5;
      // 평판
      const volume = Math.min(1, R.players / 80);
      const lost = R.visitors ? (R.balk.queue + R.balk.empty + R.balk.exchange) / R.visitors : 0;
      R.repDelta = (R.avgSat - 0.5) * 6 * volume - R.claims * 0.4 - lost * 3 - (R.visitors ? R.dirty / R.visitors * 2 : 0);
      st.reputation = clamp(st.reputation + R.repDelta, 0, 100);
      R.rep = st.reputation;
      // 인기도: 오르내린 원인을 나눠 둔다(정산 화면에 보여 준다)
      const P = Z.POP, base = (R.revenue / P.REVENUE) * (0.6 + st.reputation / 100);
      R.popReasons = {
        sales: base * 0.5,
        satisfaction: base * R.avgSat,
        soldOut: -R.balk.empty * P.PENALTY,
        exchange: -R.balk.exchange * P.PENALTY,
        dirty: -R.dirty * P.PENALTY * 0.3,
        claims: -R.claims * P.PENALTY * 3,
        decor: charm(st),
        influencer: R.influencer ? R.influencer.points : 0,
        fade: -st.popularity * (1 - P.KEEP),
      };
      const before = st.popularity;
      st.popularity = Math.max(0, before + Object.keys(R.popReasons).reduce((s, k) => s + R.popReasons[k], 0));
      R.popularity = st.popularity;
      // 랭크: 인기도와 최근 평균 일매출이 모두 필요하다
      st.avgRev = st.avgRev == null ? R.revenue : st.avgRev * 0.8 + R.revenue * 0.2;
      while (st.rank < Z.RANK_POP.length && st.popularity >= Z.RANK_POP[st.rank] && st.avgRev >= Z.RANK_REV[st.rank]) {
        st.rank++; R.rankUp = st.rank; st.rankUpDay = st.day + 1;
      }
      if (!st.champion && st.rank >= Z.RANK_POP.length && st.popularity > rivalScore(0, st.day)) { st.champion = true; R.champion = true; }
      // 도전과제용 기록
      const S = st.stats;
      S.days++; S.wins += R.wins; S.bestRevenue = Math.max(S.bestRevenue, R.revenue);
      S.stockStreak = R.balk.empty ? 0 : S.stockStreak + 1; S.bestStockStreak = Math.max(S.bestStockStreak, S.stockStreak);
      const total = Object.keys(R.tasks).reduce((s, k) => s + R.tasks[k], 0);
      if (mode === 'manual' && total >= 5 && !R.lateTasks && !tasks.some((k) => t - k.t > Z.FAST_TASK)) S.fastDays++;
      st.used = R.used;
      // 위에서 매출·획득을 이미 더했으므로 live 없이 확인한다
      R.achieved = checkAchievements(st);
      if (st.money < 0) st.bankrupt = true;
      st.history.push({ day: R.day, revenue: R.revenue, profit: R.profit, visitors: R.visitors, rep: Math.round(st.reputation), pop: Math.round(st.popularity), money: st.money });
      if (st.history.length > 365) st.history.shift();
      st.day++;
      startOfDay(st);
      report = R;
      return R;
    }

    return {
      step, close,
      act: (type, mid) => { events = []; const ok = act(type, mid); return { ok, events }; },
      claim: (type, mid, on) => { const k = findTask(type, mid == null ? null : mid); if (k) k.claimed = !!on; },
      pickLitter: () => { events = []; return pickLitter(); },
      debug: (kind) => { events = []; debug(kind); return events; },
      tasks: () => tasks.map((k) => Object.assign({}, k, { noStock: k.type === 'refill' ? !canRefill(st, byId[k.m].m) : false })),
      time: () => t,
      done: () => t >= TICKS,
      result: R,
    };
  }

  function runDay(st, opts) {
    const day = openDay(st, Object.assign({ mode: 'bot' }, opts));
    const log = opts && opts.log ? [] : null;
    while (!day.done()) { const e = day.step(60); if (log) log.push(...e); }
    const R = day.close();
    if (log) R.log = log;
    return R;
  }

  // ---------- 건너뛰기 ----------
  function canSkip(st) {
    const o = canOpen(st);
    if (!o.ok) return o;
    if (!st.staff) return { ok: false, why: '직원을 고용하면 건너뛸 수 있어요' };
    if (st.day === 1) return { ok: false, why: '첫 영업일이에요' };
    if (st.day === st.rankUpDay) return { ok: false, why: '승급한 뒤 첫 영업일이에요' };
    if (st.day === st.expandDay) return { ok: false, why: '가게를 넓힌 뒤 첫 영업일이에요' };
    if (isSpecialDay(st.day)) return { ok: false, why: '특별 공연일이에요' };
    if (!st.champion && st.rank >= Z.RANK_POP.length && st.popularity >= rivalScore(0, st.day) * Z.SKIP_NEAR_TOP) return { ok: false, why: '전국 1위에 도전하는 날이에요' };
    return { ok: true };
  }
  function skipDay(st) {
    const c = canSkip(st);
    if (!c.ok) return c;
    return { ok: true, result: runDay(st, { mode: 'staff' }) };
  }

  // ---------- 자동 준비(추천 운영): 진열 계획 → 부족한 인형 발주 → 기계 채우기 ----------
  const isArenaDay = (day) => isShowDay(day) || isSpecialDay(day);
  function tasteDemand(st) {
    const out = {};
    DATA.TASTES.forEach((x) => { out[x] = 0; });
    const open = openTastes(st), show = isArenaDay(st.day), event = eventOf(st, st.day);
    const types = custTypes.filter((c) => c.rank <= st.rank);
    const weight = (c) => c.weight * (show ? c.time.show : 1) * (event && event.category === c.id ? Z.EVENT.category : 1);
    const crowd = types.reduce((s, c) => s + weight(c), 0);
    types.forEach((c) => {
      const w = weight(c) + (c.id === 'kpop' ? crowd * foreignShare(st, st.day) * Z.FOREIGN.kpop : 0);
      const list = Object.keys(c.tastes).filter((x) => open.indexOf(x) >= 0);
      const favs = list.length ? list : open;
      const share = (x) => (list.length ? c.tastes[x] : 1) * (x === st.trend.taste ? Z.TREND.demand : 1) * (event && x === event.taste ? Z.EVENT.demand : 1);
      const sum = favs.reduce((s, x) => s + share(x), 0);
      favs.forEach((x) => { out[x] += w * share(x) / sum; });
      const more = c.likesOthers ? 0.5 : (c.extraLikes || 0) * 0.2; // 즐기는(가장 좋아하지는 않는) 취향의 몫
      open.forEach((x) => { out[x] += w * more / open.length; });
    });
    return out;
  }
  // 추천 발주 미리 보기: 상태를 바꾸지 않고, 주문할 목록과 그때의 기계별 진열 계획만 알려 준다.
  function recommendOrder(st) {
    const copy = JSON.parse(JSON.stringify(st));
    const r = autoPrep(copy);
    return { lines: r.ordered, plans: copy.machines.map((m) => ({ id: m.id, plan: m.plan })) };
  }
  function autoPrep(st, o) {
    o = o || {};
    const reserve = o.reserve != null ? o.reserve : 250000;
    const demand = tasteDemand(st), event = eventOf(st, st.day);
    const avail = DATA.DOLLS.filter((d) => orderable(st, d) || st.stock[d.id]);
    const picked = {};
    const covered = {}; // 가게 전체에서 취향이 몇 번 진열됐는지(골고루 갖추기)
    const need = {};
    placed(st).forEach((m) => {
      const def = mdef(m);
      let cand = avail.filter((d) => canHold(m, d));
      if (def.kind === 'timer') { // 초대형은 하나뿐이라 지금 가진 인형이 있으면 그중에서 고른다(비는 날이 없게)
        const owned = cand.filter((d) => m.load[d.id] || st.stock[d.id]);
        if (owned.length) cand = owned;
      }
      const top = [];
      while (!top.length && cand.length) {
        let best = null, bs = -1;
        cand.forEach((d) => {
          if (top.some((x) => x.d === d)) return;
          let sc = d.taste.reduce((s, x) => s + demand[x] / (1 + (covered[x] || 0) * 2), 0); // 이미 진열한 취향은 뒤로 미룬다
          if (m.load[d.id] || st.stock[d.id]) sc *= 1.35; // 이미 있는 인형을 먼저 쓴다(재고가 쌓이지 않게)
          if (picked[d.id]) sc *= 0.5; // 같은 인형을 여러 기계에 넣지 않게
          sc *= (def.sizeAppeal[d.size] || 1) * (hasTrend(st, d) ? 1.2 : 1) / Math.pow(d.cost / (def.grab ? 1 : 30000), def.grab ? 0.15 : 1);
          if (sc > bs) { bs = sc; best = d; }
        });
        top.push({ d: best, sc: bs });
        best.taste.forEach((x) => { covered[x] = (covered[x] || 0) + 1; });
      }
      // 기계 하나에 한 종류를 가득
      m.plan = {}; m.manual = false;
      if (top.length) { m.plan[top[0].d.id] = capacityOf(m, top[0].d.id); picked[top[0].d.id] = 1; }
      Object.keys(m.plan).forEach((id) => { need[id] = (need[id] || 0) + m.plan[id]; });
    });
    // 부족분 발주(하루 소진을 버틸 여유분: 일반 인형은 진열의 3배, 초대형은 5배)
    // 돈이 적어도 인형은 사야 장사가 된다: 남겨 두는 돈은 가진 돈의 30%를 넘지 않는다
    let budget = st.money - Math.min(reserve, Math.max(0, st.money) * 0.3), cap = whLv(st).cap - stockTotal(st) - incomingTotal(st);
    const buy = [];
    const have = (id) => st.machines.reduce((n, m) => n + (m.load[id] ? m.load[id].qty : 0), 0) + (st.stock[id] ? st.stock[id].qty : 0);
    const first = (id) => (doll(id).size === 'XL' ? -1 : have(id) / need[id]); // 초대형은 하나뿐이라 먼저 챙긴다
    Object.keys(need).sort((a, b) => first(a) - first(b)).forEach((id) => { // 모자란 인형부터
      const d = doll(id);
      if (!orderable(st, d)) return;
      const inMachines = st.machines.reduce((n, m) => n + (m.load[id] ? m.load[id].qty : 0), 0);
      const inStock = st.stock[id] ? st.stock[id].qty : 0;
      const inc = st.incoming.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);
      const rush = (isArenaDay(st.day) && d.taste[0] === '아이돌') || (event && d.taste[0] === event.taste) ? 2 : 1; // 공연일·행사일에는 그 인형을 두 배 준비
      const want = (d.size === 'XL' ? need[id] * 5 : need[id] * 3) * rush - inMachines - inStock - inc;
      const q = Math.min(want, cap);
      if (q <= 0) return;
      const uc = unitCost(st, id, q);
      const aff = Math.min(q, Math.floor(budget / uc));
      if (aff > 0) { buy.push({ id, qty: aff }); budget -= aff * uc; cap -= aff; }
    });
    if (o.order === false) buy.length = 0; // 발주 없이 진열만
    if (buy.length) order(st, buy);
    placed(st).forEach((m) => unloadAll(st, m)); // 아침마다 계획대로 다시 진열한다
    refillAll(st);
    return { ordered: buy };
  }

  // ---------- 랭크 / 전국 순위 ----------
  // 내부 단계(st.rank): 1 = 5랭크(시작) ... 5 = 1랭크. 화면에는 rankNo(5~1)로 보여 준다.
  function rankNo(st) { return 6 - st.rank; }
  function rankName(st) { return DATA.RANK_NAMES[st.rank - 1]; }
  function rivalName(i) {
    const A = ['별빛', '달콩', '뭉게', '솜사탕', '도토리', '무지개', '포근', '반짝', '콩닥', '하늘', '바람', '노을', '새싹', '구슬', '보름달', '꿈꾸는', '햇살', '버들', '아침', '단풍'];
    const B = ['인형방', '뽑기랜드', '드림샵', '플레이존', '월드', '스튜디오', '하우스', '센터', '파크', '클럽'];
    return A[(i * 7 + 3) % A.length] + ' ' + B[(i * 3 + Math.floor(i / A.length)) % B.length] + (i >= 100 ? ' ' + (Math.floor(i / 100) + 1) + '호점' : '');
  }
  function rivalScore(i, day) { // i = 0(1위) ~ N-1. 점수는 순위 기본값에 시즌 변동과 서서히 성장
    const N = Z.NATIONAL;
    const base = N.TOP * Math.pow(i + 1, -N.EXP);
    const grow = 1 - N.GROWTH + N.GROWTH * Math.min(1, day / N.GROWTH_DAYS) * 2; // 0.9 → 1.1
    const wobble = 1 + 0.02 * Math.sin(day / 30 + i * 1.7);
    return base * grow * wobble;
  }
  // 전국 순위표. 1랭크(단계 5)가 되어야 자세한 순위가 나온다. top = 상위 몇 명을 보여 줄지.
  function leaderboard(st, top) {
    const detail = st.rank >= Z.RANK_POP.length;
    const rivals = [];
    for (let i = 0; i < Z.NATIONAL.N; i++) rivals.push({ name: rivalName(i), score: rivalScore(i, st.day) });
    rivals.sort((a, b) => b.score - a.score);
    const pos = 1 + rivals.filter((r) => r.score > st.popularity).length;
    const out = { detail, position: detail ? pos : null, total: Z.NATIONAL.N, score: st.popularity, entries: [] };
    if (!detail) return out;
    const all = rivals.slice();
    all.splice(pos - 1, 0, { name: st.shopName || '내 가게', score: st.popularity, me: true });
    all.forEach((r, i) => { r.pos = i + 1; });
    out.entries = all.slice(0, top || 10);
    if (pos > (top || 10)) out.entries = out.entries.concat(all.slice(Math.max(0, pos - 2), pos + 1)); // 내 주변
    return out;
  }

  return {
    rankNo, rankName, leaderboard,
    newGame, startOfDay, openDay, runDay, canSkip, skipDay, forecast, autoPrep, recommendOrder,
    buyMachine, sellMachine, buyEquipment, expandWarehouse, expandShop, hireStaff, setOption, order, unitCost, orderable, nextSpecial,
    loadMachine, unloadAll, refill, addStock, sellStock,
    upgradeState, canOpen, canInstall, installMachine, storeMachine, sellBin, sellEquipment, buyDecor, sellDecor, canBuyDecor, decorDef, charm, charmRaw, charmCap, checkAchievements, statValue,
    info: { capacityOf, exchangerOn, placed, placedBins, canRefill, slotsOf, slotsUsed, loadQty, freeSlots, footUsed, stockTotal, incomingTotal, canHold, grabProb, doll, TICKS, isShowDay, isSpecialDay, eventOf, holidayOf, foreignShare, calOf, seasonOf },
  };
})();
