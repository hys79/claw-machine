// 가게 화면: 건축 화면(영업 전 준비: 배치·상점·발주·기계 설정) ↔ 영업 화면(실시간) → 정산.
// 계산은 전부 Sim(js/sim.js), 바닥 그림은 ShopView(js/shopview.js). 좌표는 가운데 960 영역 기준.
const Game = (function () {
  const C = CFG.COLOR;
  const MIN_PER_SEC = (CFG.SIM.CLOSE - CFG.SIM.OPEN) * 60 / 120; // 1배속: 하루 영업을 120초에
  const DOW = ['월', '화', '수', '목', '금', '토', '일'];
  const WEATHER = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈' };
  const TASK = { refill: '보충', clean: '청소', exchange: '환전', repair: '수리' };
  const BALK = { nothing: '취향이 없네', budget: '돈이 모자라', queue: '줄이 길어', empty: '비었잖아', exchange: '환전이 안 돼' };
  const MAX_ACTORS = 16;

  let st = null;          // 시뮬레이션 상태(State.data.sim)
  let phase = 'build';    // build | open | result
  let popup = null;       // null | shop | order | plan
  let sel = null;         // 선택한 기계 번호
  let drag = null;        // 끌고 있는 기계: {m, dx, dy, from, x, y, moved}
  let scope = 'one';      // 난이도·가격 적용 범위
  let tab = 'machine';    // 상점 탭
  let page = 0;
  let cart = {};
  let msg = null;         // {text, until}
  let day = null, snapshot = null, speed = 1, paused = false, acc = 0, last = null;
  let actors = [], pops = [], today = null, result = null;
  let clockNow = 0;

  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR') + '원';
  const man = (n) => (Math.abs(n) >= 10000 ? (Math.round(n / 1000) / 10).toLocaleString('ko-KR') + '만' : Math.round(n).toLocaleString('ko-KR'));
  const mname = (m) => DATA.MACHINES[m.type].name.replace(' 뽑기 기계', '') + ' #' + m.id;
  const say = (text) => { msg = { text, until: clockNow + 2.2 }; };
  const save = () => State.save();
  // 구매 결과를 알려 주고 저장한다
  function done(r, okText) {
    if (r.ok) { Sound.sfx('confirm'); if (okText) say(okText); ShopView.autoPlace(st); save(); } else { Sound.sfx('buzz'); say(r.why); }
  }

  function enter() {
    const d = State.data;
    if (!d.sim || d.sim.v !== 2) {
      d.sim = Sim.newGame(d.playerName, d.shopName);
      Sim.autoPrep(d.sim, { order: false }); // 가진 인형만으로 첫 진열(발주 없음)
    }
    st = d.sim;
    ShopView.autoPlace(st);
    phase = 'build'; popup = null; sel = null; drag = null; day = null; result = null; msg = null; last = null; cart = {};
    save();
  }
  // 화면을 나갈 때: 영업 중이었다면 그날 시작 전 상태로 되돌린다.
  function leave() {
    if (phase === 'open' && snapshot) State.data.sim = JSON.parse(snapshot);
    day = null; phase = 'build'; popup = null; drag = null;
  }
  function escape() { if (popup) { popup = null; return true; } return false; }

  // ---------- 영업 ----------
  function openShop() {
    ShopView.autoPlace(st);
    save();
    snapshot = JSON.stringify(st);
    day = Sim.openDay(st, { mode: 'manual' });
    phase = 'open'; popup = null; sel = null; speed = 1; paused = false; acc = 0; last = null;
    actors = []; pops = []; today = { revenue: 0, visitors: 0, wins: 0 };
    Sound.sfx('doorbell');
  }
  function finishDay() {
    result = day.close();
    day = null; phase = 'result'; snapshot = null;
    Sound.sfx(result.rankUp ? 'fanfare' : 'prize');
    save();
  }
  function skip() {
    const r = Sim.skipDay(st);
    if (!r.ok) { say(r.why); Sound.sfx('buzz'); return; }
    result = r.result; phase = 'result'; popup = null; save();
  }
  function pop(x, y, text, color) { if (pops.length < 24) pops.push({ x, y, text, color, t: clockNow }); }

  function onEvents(events) {
    const g = ShopView.geom(st.shopLevel), door = ShopView.doorPoint(g);
    const find = (id) => actors.find((a) => a.id === id);
    const mach = (id) => st.machines.find((m) => m.id === id);
    events.forEach((e) => {
      if (e.type === 'arrive') {
        today.visitors++;
        if (actors.length >= MAX_ACTORS) return; // 대표 손님만 그린다
        const P = Cutscene.art.NPC_PALS;
        const pal = P[(e.cat === 'mania' ? 1 : e.cat === 'kpop' ? 2 : 0) % P.length];
        actors.push({ id: e.c, cat: e.cat, pal: e.cat === 'normal' ? P[e.c % P.length] : pal, x: door.x, y: door.y + 6, tx: door.x - 20 - (e.c % 5) * 22, ty: door.y - 14 - (e.c % 3) * 8, leaving: false, born: clockNow });
      } else if (e.type === 'play' || e.type === 'win') {
        const m = mach(e.m), a = find(e.c);
        if (!m) return;
        today.revenue += m.price;
        if (e.type === 'win') today.wins++;
        const p = ShopView.standPoint(g, m);
        if (a) { a.tx = p.x + ((e.c % 3) - 1) * 12; a.ty = p.y; }
        if (e.type === 'win') { pop(p.x, p.y - 60, '획득!', '#2f9e5b'); Sound.sfx('prize'); }
      } else if (e.type === 'leave' || e.type === 'balk') {
        const a = find(e.c);
        if (!a) return;
        a.wantLeave = true; // 바로 사라지지 않고, 자리에 가서 잠깐 머문 뒤 나간다
        if (e.type === 'balk') pop(a.x, a.y - 40, BALK[e.why] || '…', C.alert);
      } else if (e.type === 'task') {
        if (speed > 1) { speed = 1; say('할 일이 생겨 1배속으로 바꿨어요'); }
        Sound.sfx('notif');
      }
    });
  }
  function doTask(k) {
    const r = day.act(k.type, k.m);
    if (r.ok) Sound.sfx(k.type === 'repair' ? 'hammer' : 'confirm');
    else { Sound.sfx('buzz'); say('창고에 채울 인형이 없어요'); }
    onEvents(r.events);
  }
  function update(now) {
    const dt = last == null ? 0 : Math.max(0, Math.min(0.1, now - last));
    last = now; clockNow = now;
    if (phase !== 'open' || paused) return;
    acc += dt * MIN_PER_SEC * speed;
    if (acc >= 1) { const n = Math.floor(acc); acc -= n; onEvents(day.step(n)); }
    const v = 110 * speed * dt;
    const door = ShopView.doorPoint(ShopView.geom(st.shopLevel));
    actors.forEach((a) => {
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      a.moving = d > 1;
      if (d <= v) { a.x = a.tx; a.y = a.ty; } else { a.x += dx / d * v; a.y += dy / d * v; }
      if (Math.abs(dx) > 2) a.left = dx < 0;
      a.dwell = a.moving ? 0 : (a.dwell || 0) + dt * speed;
      if (a.wantLeave && !a.leaving && a.dwell > 1.6) { a.leaving = true; a.moving = true; a.tx = door.x; a.ty = door.y + 8; }
    });
    actors = actors.filter((a) => !(a.leaving && !a.moving));
    if (day.done()) finishDay();
  }

  // ---------- 건축 화면의 끌어 놓기 ----------
  function press(p) {
    if (phase !== 'build' || popup) return;
    const g = ShopView.geom(st.shopLevel);
    const hit = st.machines.slice().sort((a, b) => b.pos.y - a.pos.y).find((m) => {
      const r = ShopView.machineRect(g, m);
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    });
    if (!hit) { if (p.x < 720 && p.y > 60 && p.y < 500) sel = null; return; }
    const r = ShopView.machineRect(g, hit);
    sel = hit.id;
    drag = { m: hit, dx: p.x - r.x, dy: p.y - r.y, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    Sound.sfx('click');
  }
  function move(p) {
    if (!drag) return;
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
  }
  function dragCell() {
    const g = ShopView.geom(st.shopLevel);
    return { x: Math.round((drag.x - drag.dx - 3 - g.x) / ShopView.CW), y: Math.round((drag.y - drag.dy + 26 - g.y) / ShopView.CH) };
  }
  function release() {
    if (!drag) return;
    if (drag.moved) {
      const c = dragCell();
      if (ShopView.canPlace(st, drag.m, c.x, c.y)) { drag.m.pos = c; Sound.sfx('confirm'); save(); }
      else { Sound.sfx('buzz'); say('여기에는 놓을 수 없어요'); }
    }
    drag = null;
  }

  // ---------- 공통 그리기 ----------
  const btn = (x, y, w, h, label, onClick, o) => UI.button({ x, y, w, h }, label, Object.assign({ style: 'secondary', size: 14, onClick }, o));
  const label = (t, x, y, color, align, size) => UI.text(t, x, y, size || 14, color || C.ink, align || 'left');

  function actorDraw(ctx, a, now) {
    const art = Cutscene.art;
    const rows = a.moving ? art.ME_WALK[Math.floor(now * 8 + a.id) % 4] : art.ME_BACK;
    const img = art.outlinedImg(rows, a.pal);
    const s = 2;
    UI.rect(a.x - 12, a.y - 3, 24, 5, 'rgba(20,50,77,0.22)');
    ctx.save();
    ctx.translate(Math.round(a.x), Math.round(a.y - img.height * s));
    if (a.moving && a.left) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width * s / 2, 0, img.width * s, img.height * s);
    ctx.restore();
    if (a.cat !== 'normal') label(a.cat === 'kpop' ? '팬' : '마니아', a.x, a.y - img.height * s - 8, a.cat === 'kpop' ? '#8a4fc0' : '#8a5a1a', 'center');
  }

  function topBar(now) {
    UI.rect(-600, 0, 2200, 56, C.white);
    UI.rect(-600, 56, 2200, 3, C.ink);
    const env = (phase === 'result' ? result : st.env) || {}; // 정산 중에는 방금 끝난 날의 날씨
    const dayNo = phase === 'result' ? result.day : st.day;
    label(dayNo + '일차 (' + DOW[(dayNo - 1) % 7] + ')', 16, 18, C.ink, 'left', 18);
    label((WEATHER[env.weather] || '') + (env.special ? ' · 특별 공연!' : env.show ? ' · 공연일' : ''), 16, 41, env.special || env.show ? C.alert : C.sub);
    UI.moneyPill({ x: 160, y: 12, w: 180, h: 32 }, won(st.money));
    label(Sim.rankNo(st) + '랭크', 366, 18, C.blue, 'left', 18);
    const next = CFG.SIM.RANK_POP[st.rank];
    label(next ? '인기 ' + Math.round(st.popularity) + ' / ' + next : '인기 ' + Math.round(st.popularity) + ' · 전국 ' + Sim.leaderboard(st, 1).position + '위', 366, 41, C.sub);
  }

  // ---------- 건축 화면 ----------
  function drawBuild(ctx) {
    ShopView.room(st, { grid: true });
    const g = ShopView.geom(st.shopLevel);
    st.machines.slice().sort((a, b) => a.pos.y - b.pos.y).forEach((m) => {
      if (drag && drag.moved && drag.m === m) return;
      ShopView.machine(m, ShopView.machineRect(g, m), { selected: sel === m.id });
    });
    if (drag && drag.moved) {
      const c = dragCell(), ok = ShopView.canPlace(st, drag.m, c.x, c.y);
      const r = ShopView.machineRect(g, { type: drag.m.type, pos: c });
      ShopView.machine(drag.m, r, { ghost: ok ? 'ok' : 'no' });
    }
    topBar();
    label('기계 칸 ' + Sim.info.footUsed(st) + ' / ' + CFG.SIM.SHOP[st.shopLevel].slots, 560, 18);
    label('창고 ' + Sim.info.stockTotal(st) + ' / ' + CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, 560, 41);
    label('유행 ' + st.trend.taste + ' → 다음 ' + st.trend.next, 700, 18, '#8a4fc0');
    label('예상 손님 ' + Sim.forecast(st) + '명', 700, 41, C.sub);
    sidePanel();
    btn(20, 514, 130, 46, '상점', () => { popup = 'shop'; page = 0; }, { size: 18 });
    btn(164, 514, 130, 46, '인형 발주', () => { popup = 'order'; page = 0; cart = {}; }, { size: 18 });
    btn(308, 514, 130, 46, '추천 진열', () => { Sim.autoPrep(st, { order: false }); say('가진 인형으로 다시 진열했어요'); save(); }, { size: 18 });
    const can = Sim.canSkip(st);
    if (st.staff) btn(452, 514, 130, 46, '건너뛰기', skip, { size: 18, style: can.ok ? 'secondary' : 'soft' });
    btn(742, 514, 198, 46, '영업 시작', openShop, { style: 'primary', size: 22 });
  }

  function sidePanel() {
    const p = { x: 732, y: 74, w: 210, h: 424 };
    UI.panel(p, C.white, 3);
    const m = st.machines.find((x) => x.id === sel);
    if (!m) {
      label('가게 꾸미기', p.x + p.w / 2, p.y + 30, C.ink, 'center', 18);
      ['기계를 끌어서', '자리를 옮겨요.', '', '기계를 누르면', '난이도, 가격,', '진열을 바꿔요.', '', '주문한 인형은', '다음 영업 아침에', '들어와요.'].forEach((t, i) => label(t, p.x + p.w / 2, p.y + 70 + i * 24, C.sub, 'center'));
      const miss = st.lastMissed;
      if (miss) {
        label('어제 손님이 찾은 취향', p.x + p.w / 2, p.y + 330, C.ink, 'center');
        label(miss.length ? miss.join(', ') : '없음', p.x + p.w / 2, p.y + 356, C.alert, 'center');
      }
      return;
    }
    const def = DATA.MACHINES[m.type], timer = def.kind === 'timer';
    label(mname(m), p.x + p.w / 2, p.y + 22, C.ink, 'center', 18);
    label('진열 ' + Sim.info.slotsUsed(m) + ' / ' + Sim.info.slotsOf(m) + ' 칸', p.x + p.w / 2, p.y + 48, C.sub, 'center');
    const row = (y, name, value, minus, plus) => {
      label(name, p.x + 12, y + 17);
      btn(p.x + 66, y, 32, 34, '-', minus);
      label(value, p.x + 134, y + 17, C.ink, 'center');
      btn(p.x + 170, y, 32, 34, '+', plus);
    };
    const set = (k, v) => { Sim.setOption(st, m.id, k, v, scope); save(); };
    row(p.y + 66, '난이도', m.difficulty + '단계', () => set('difficulty', m.difficulty - 1), () => set('difficulty', m.difficulty + 1));
    row(p.y + 108, '가격', won(m.price), () => set('price', m.price - 100), () => set('price', m.price + 100));
    [['one', '이 기계'], ['type', '같은 종류'], ['all', '전체']].forEach(([k, t], i) => btn(p.x + 8 + i * 66, p.y + 152, 62, 30, t, () => { scope = k; }, { style: scope === k ? 'primary' : 'secondary' }));
    btn(p.x + 12, p.y + 196, p.w - 24, 38, '인형 진열 바꾸기', () => { popup = 'plan'; page = 0; }, { style: 'primary' });
    let y = p.y + 248;
    ['capacity', 'durable'].forEach((k) => {
      const e = DATA.EQUIPMENT[k];
      if (k === 'capacity' && timer) return;
      const have = m.mods[k], locked = e.rank > st.rank;
      btn(p.x + 12, y, p.w - 24, 36, have ? e.name + ' 완료' : locked ? (6 - e.rank) + '랭크에 개조 가능' : (k === 'capacity' ? '대용량 ' : '내구성 ') + man(e.price), () => done(Sim.buyEquipment(st, k, m.id), '개조했어요'), { disabled: have || locked });
      y += 44;
    });
    btn(p.x + 12, p.y + p.h - 50, p.w - 24, 36, '팔기 +' + man(def.price * 0.4), () => {
      if (st.machines.length <= 1) { say('기계는 한 대 이상 있어야 해요'); return; }
      done(Sim.sellMachine(st, m.id), '기계를 팔았어요'); sel = null;
    });
  }

  // ---------- 팝업 ----------
  const PANEL = { x: 100, y: 70, w: 760, h: 470 };
  function popupFrame(title, titleX) {
    UI.block({ x: -600, y: 0, w: 2200, h: 576 });
    UI.rect(-600, 59, 2200, 517, C.scrim);
    UI.panel(PANEL, C.white);
    UI.text(title, titleX || 480, PANEL.y + 30, 22, C.ink);
    UI.hline(PANEL.x + 20, PANEL.y + 54, PANEL.w - 40);
    btn(PANEL.x + PANEL.w - 96, PANEL.y + 12, 80, 34, '닫기', () => { popup = null; });
  }
  function pager(count, per) {
    const pages = Math.max(1, Math.ceil(count / per));
    page = Math.min(page, pages - 1);
    if (pages > 1) {
      btn(PANEL.x + 20, PANEL.y + PANEL.h - 50, 60, 34, '이전', () => { page = (page + pages - 1) % pages; });
      label((page + 1) + ' / ' + pages, PANEL.x + 110, PANEL.y + PANEL.h - 33, C.sub, 'center');
      btn(PANEL.x + 140, PANEL.y + PANEL.h - 50, 60, 34, '다음', () => { page = (page + 1) % pages; });
    }
  }

  function drawShopPopup() {
    popupFrame('상점', 580); // 왼쪽의 탭 버튼과 겹치지 않게
    [['machine', '기계'], ['equip', '설비'], ['grow', '확장·직원']].forEach(([k, t], i) => btn(PANEL.x + 20 + i * 110, PANEL.y + 12, 100, 34, t, () => { tab = k; page = 0; }, { style: tab === k ? 'primary' : 'secondary' }));
    const rows = [];
    const rankLock = (r) => (r > st.rank ? (6 - r) + '랭크부터' : null);
    if (tab === 'machine') {
      Object.keys(DATA.MACHINES).forEach((k) => {
        const d = DATA.MACHINES[k];
        rows.push({ name: d.name, desc: '칸 ' + d.footprint + ' · 넣는 크기 ' + d.sizes.join(' ') + ' · 하루 전기 ' + man(d.power), price: d.price, lock: rankLock(d.rank), buy: () => done(Sim.buyMachine(st, k), '새 기계를 들였어요. 진열을 해 주세요') });
      });
    } else if (tab === 'equip') {
      Object.keys(DATA.EQUIPMENT).filter((k) => !DATA.EQUIPMENT[k].perMachine).forEach((k) => {
        const e = DATA.EQUIPMENT[k];
        rows.push({ name: e.name, desc: e.desc, price: e.price, lock: st.equip[k] ? '보유 중' : rankLock(e.rank), buy: () => done(Sim.buyEquipment(st, k), e.name + ' 설치!') });
      });
    } else {
      const s = CFG.SIM.SHOP[st.shopLevel + 1], w = CFG.SIM.WAREHOUSE[st.warehouseLevel + 1], S = CFG.SIM.STAFF;
      if (s) rows.push({ name: '가게 확장: ' + s.name, desc: '기계 칸 ' + s.slots + ' · 월 임대료 ' + man(s.rent), price: s.cost, lock: rankLock(s.rank), buy: () => done(Sim.expandShop(st), '가게를 넓혔어요!') });
      if (w) rows.push({ name: '창고 확장: ' + w.cap + '개', desc: '하루 유지비 ' + man(w.upkeep), price: w.cost, buy: () => done(Sim.expandWarehouse(st), '창고를 넓혔어요') });
      rows.push({ name: '직원 고용', desc: '하루 월급 ' + man(S.wage) + ' · 건너뛰기가 열려요', price: 0, lock: st.staff ? '근무 중' : rankLock(S.rank), buy: () => done(Sim.hireStaff(st), '직원이 들어왔어요') });
    }
    rows.forEach((r, i) => {
      const y = PANEL.y + 70 + i * 62;
      label(r.name, PANEL.x + 30, y + 12, C.ink, 'left', 18);
      label(r.desc, PANEL.x + 30, y + 38, C.sub);
      label(r.price ? won(r.price) : '', PANEL.x + 600, y + 25, r.price > st.money ? C.alert : C.ink, 'right', 18);
      btn(PANEL.x + 620, y + 6, 120, 40, r.lock || '구입', r.buy, { style: 'primary', disabled: !!r.lock });
      UI.hline(PANEL.x + 20, y + 54, PANEL.w - 40);
    });
  }

  function drawOrderPopup() {
    popupFrame('인형 발주');
    const list = DATA.DOLLS.filter((d) => Sim.orderable(st, d))
      .sort((a, b) => (b.taste.indexOf(st.trend.taste) >= 0) - (a.taste.indexOf(st.trend.taste) >= 0));
    const per = 7;
    pager(list.length, per);
    label('인형 (크기 · 취향)', PANEL.x + 56, PANEL.y + 70, C.sub);
    label('단가', PANEL.x + 400, PANEL.y + 70, C.sub, 'right');
    label('보유', PANEL.x + 470, PANEL.y + 70, C.sub, 'right');
    label('주문 수량', PANEL.x + 600, PANEL.y + 70, C.sub, 'center');
    let total = 0, count = 0;
    Object.keys(cart).forEach((id) => { total += Sim.unitCost(st, id, cart[id]) * cart[id]; count += cart[id]; });
    list.slice(page * per, page * per + per).forEach((d, i) => {
      const y = PANEL.y + 86 + i * 44;
      const trend = d.taste.indexOf(st.trend.taste) >= 0;
      const q = cart[d.id] || 0;
      const have = (st.stock[d.id] ? st.stock[d.id].qty : 0) + st.machines.reduce((n, m) => n + (m.load[d.id] ? m.load[d.id].qty : 0), 0);
      const coming = st.incoming.filter((x) => x.id === d.id).reduce((n, x) => n + x.qty, 0);
      ShopView.dollIcon(PANEL.x + 26, y + 8, d, 3);
      label(d.name + (d.special ? ' [한정]' : ''), PANEL.x + 56, y + 10);
      label(d.size + ' · ' + d.taste.join(', ') + (trend ? '  ★유행' : ''), PANEL.x + 56, y + 30, trend ? '#8a4fc0' : C.sub);
      label(won(Sim.unitCost(st, d.id, Math.max(1, q))), PANEL.x + 400, y + 20, C.ink, 'right');
      label(have + (coming ? ' +' + coming : ''), PANEL.x + 470, y + 20, C.ink, 'right');
      const add = (n) => { cart[d.id] = Math.max(0, q + n); if (!cart[d.id]) delete cart[d.id]; };
      btn(PANEL.x + 490, y + 4, 40, 32, '-10', () => add(-10));
      btn(PANEL.x + 536, y + 4, 28, 32, '-', () => add(-1));
      label(String(q), PANEL.x + 600, y + 20, q ? C.blue : C.sub, 'center', 18);
      btn(PANEL.x + 636, y + 4, 28, 32, '+', () => add(1));
      btn(PANEL.x + 670, y + 4, 40, 32, '+10', () => add(10));
    });
    const by = PANEL.y + PANEL.h - 50;
    label('합계 ' + won(total) + ' (' + count + '개)', PANEL.x + 420, by + 6, total > st.money ? C.alert : C.ink, 'right', 18);
    label('창고 ' + (Sim.info.stockTotal(st) + Sim.info.incomingTotal(st) + count) + ' / ' + CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, PANEL.x + 420, by + 30, C.sub, 'right');
    btn(PANEL.x + 450, by, 140, 36, '추천 발주', () => {
      const r = Sim.autoPrep(st);
      const n = r.ordered.reduce((s, x) => s + x.qty, 0);
      say(n ? n + '개를 주문하고 진열했어요' : '더 주문할 인형이 없어요'); cart = {}; save();
    });
    btn(PANEL.x + 604, by, 136, 36, '주문하기', () => {
      const r = Sim.order(st, Object.keys(cart).map((id) => ({ id, qty: cart[id] })));
      done(r, r.ok ? r.qty + '개 주문 완료. 다음 영업 아침에 와요' : '');
      if (r.ok) cart = {};
    }, { style: 'primary', disabled: !count });
  }

  // 진열: 기계에 넣을 인형 수를 정한다(창고에 있는 인형만).
  function drawPlanPopup() {
    const m = st.machines.find((x) => x.id === sel);
    if (!m) { popup = null; return; }
    const def = DATA.MACHINES[m.type];
    popupFrame(mname(m) + ' 진열  (' + Sim.info.slotsUsed(m) + ' / ' + Sim.info.slotsOf(m) + ' 칸)');
    const have = (id) => (st.stock[id] ? st.stock[id].qty : 0);
    const list = DATA.DOLLS.filter((d) => Sim.info.canHold(m, d) && (have(d.id) || m.load[d.id]));
    const per = 7;
    pager(list.length, per);
    if (!list.length) label('넣을 수 있는 인형이 창고에 없어요. 먼저 발주해 주세요.', 480, 290, C.sub, 'center', 18);
    const change = (d, n) => {
      const cur = m.load[d.id] ? m.load[d.id].qty : 0;
      if (n > 0) Sim.loadMachine(st, m, d.id, n);
      else if (cur) { const take = Math.min(cur, -n); Sim.addStock(st, d.id, take, m.load[d.id].cost); m.load[d.id].qty -= take; if (!m.load[d.id].qty) delete m.load[d.id]; }
      // 지금 진열을 계획으로 기억한다(영업 중 보충도 이 구성으로)
      m.manual = true; m.plan = {};
      Object.keys(m.load).forEach((id) => { m.plan[id] = m.load[id].qty; });
      save();
    };
    list.slice(page * per, page * per + per).forEach((d, i) => {
      const y = PANEL.y + 70 + i * 46;
      const q = m.load[d.id] ? m.load[d.id].qty : 0;
      ShopView.dollIcon(PANEL.x + 30, y + 8, d, 3);
      label(d.name, PANEL.x + 66, y + 10);
      label(d.size + ' · ' + d.taste.join(', ') + ' · 칸 ' + def.slotCost[d.size] + ' · 성공 ' + (Sim.info.grabProb(m, d, 1) * 100).toFixed(1) + '%', PANEL.x + 66, y + 30, C.sub);
      label('창고 ' + have(d.id), PANEL.x + 520, y + 20, C.sub, 'right');
      btn(PANEL.x + 540, y + 4, 40, 34, '-5', () => change(d, -5));
      btn(PANEL.x + 586, y + 4, 32, 34, '-', () => change(d, -1));
      label(String(q), PANEL.x + 640, y + 21, q ? C.blue : C.sub, 'center', 18);
      btn(PANEL.x + 662, y + 4, 32, 34, '+', () => change(d, 1));
      btn(PANEL.x + 700, y + 4, 40, 34, '+5', () => change(d, 5));
    });
    btn(PANEL.x + 560, PANEL.y + PANEL.h - 50, 180, 36, '전부 빼기', () => { Sim.unloadAll(st, m); m.plan = {}; m.manual = true; save(); });
  }

  // ---------- 영업 화면 ----------
  function drawOpen(ctx, now) {
    ShopView.room(st);
    const g = ShopView.geom(st.shopLevel);
    const tasks = day.tasks();
    const downIds = tasks.filter((k) => k.type === 'repair').map((k) => k.m);
    if (tasks.some((k) => k.type === 'clean')) for (let i = 0; i < 14; i++) UI.rect(g.x + 20 + (i * 97) % (g.w - 40), g.y + g.h - 12 - (i * 53) % (g.h - 80), 6, 4, i % 2 ? '#9a8a6a' : '#b0b8c0');
    // 기계와 손님을 아래에 있는 것이 앞에 오도록 그린다
    st.machines.map((m) => ({ y: g.y + (m.pos.y + 1) * ShopView.CH, f: () => ShopView.machine(m, ShopView.machineRect(g, m), { down: downIds.indexOf(m.id) >= 0 }) }))
      .concat(actors.map((a) => ({ y: a.y, f: () => actorDraw(ctx, a, now) })))
      .sort((a, b) => a.y - b.y).forEach((o) => o.f());
    pops = pops.filter((p) => now - p.t < 1.1);
    pops.forEach((p) => UI.text(p.text, p.x, p.y - (now - p.t) * 24, 14, p.color, 'center', C.white, 4));
    // 할 일 말풍선(누르면 처리)
    tasks.forEach((k) => {
      let x, y;
      if (k.m != null) { const r = ShopView.machineRect(g, st.machines.find((m) => m.id === k.m)); x = r.x + r.w / 2; y = r.y - 4 - (k.type === 'repair' && tasks.some((o) => o.m === k.m && o.type === 'refill') ? 34 : 0); }
      else if (k.type === 'exchange') { x = g.x + ShopView.CW / 2; y = g.y + g.h - ShopView.CH - 4; }
      else { x = g.x + ShopView.CW * 2; y = g.y + g.h - 52; }
      const bounce = Math.floor(now * 4) % 2 * 2;
      btn(x - 30, y - 26 - bounce, 60, 28, TASK[k.type] + (k.type === 'exchange' ? ' ' + k.waiting : ''), () => doTask(k), { style: k.type === 'repair' ? 'danger' : 'primary' });
    });
    topBar(now);
    const t = day.time(), hh = CFG.SIM.OPEN + Math.floor(t / 60), mm = String(t % 60).padStart(2, '0');
    label(hh + ':' + mm, 590, 29, C.ink, 'center', 28);
    [['❚❚', 0], ['1배', 1], ['2배', 2], ['4배', 4]].forEach(([tx, v], i) => {
      const on = v === 0 ? paused : (!paused && speed === v);
      btn(660 + i * 54, 12, 46, 32, v === 0 ? '정지' : tx, () => { if (v === 0) paused = !paused; else { speed = v; paused = false; } }, { style: on ? 'primary' : 'secondary' });
    });
    // 진행 막대
    UI.rect(20, 502, 690, 8, C.line);
    UI.rect(20, 502, 690 * t / Sim.info.TICKS, 8, C.blue);
    label('방문 ' + today.visitors + '명', 20, 534, C.ink, 'left', 18);
    label('획득 ' + today.wins + '개', 200, 534, C.ink, 'left', 18);
    label('오늘 매출 ' + won(today.revenue), 380, 534, C.blue, 'left', 18);
    const p = { x: 732, y: 74, w: 210, h: 478 };
    UI.panel(p, C.white, 3);
    label('할 일 ' + tasks.length, p.x + p.w / 2, p.y + 24, C.ink, 'center', 18);
    if (!tasks.length) label('지금은 한가해요', p.x + p.w / 2, p.y + 70, C.sub, 'center');
    tasks.slice(0, 9).forEach((k, i) => {
      const m = k.m != null ? st.machines.find((x) => x.id === k.m) : null;
      btn(p.x + 12, p.y + 46 + i * 46, p.w - 24, 36, TASK[k.type] + (m ? ' · ' + mname(m) : k.type === 'exchange' ? ' · ' + k.waiting + '명' : ''), () => doTask(k), { style: k.type === 'repair' ? 'danger' : 'secondary' });
    });
  }

  // ---------- 정산 ----------
  function drawResult() {
    ShopView.room(st);
    topBar();
    popupResult();
  }
  function popupResult() {
    const R = result;
    UI.rect(-600, 59, 2200, 517, C.scrim);
    UI.panel(PANEL, C.white);
    UI.text(R.day + '일차 정산', 480, PANEL.y + 30, 22, C.ink);
    UI.hline(PANEL.x + 20, PANEL.y + 54, PANEL.w - 40);
    const money = [['매출', R.revenue], ['인형 원가', -R.payout], ['임대료', -R.rent], ['전기·유지비', -(R.power + R.upkeep)], ['수리비', -R.repair], ['월급', -R.wage]];
    money.forEach((r, i) => {
      const y = PANEL.y + 86 + i * 30;
      label(r[0], PANEL.x + 40, y, C.sub);
      label(won(r[1]), PANEL.x + 330, y, C.ink, 'right');
    });
    UI.hline(PANEL.x + 40, PANEL.y + 266, 290);
    label('오늘 손익', PANEL.x + 40, PANEL.y + 290, C.ink, 'left', 18);
    label(won(R.profit), PANEL.x + 330, PANEL.y + 290, R.profit >= 0 ? C.blue : C.alert, 'right', 22);
    label('방문 ' + R.visitors + '명 · ' + R.plays + '판 · 획득 ' + R.wins + '개', PANEL.x + 40, PANEL.y + 326, C.sub);
    label('평판 ' + Math.round(R.rep) + ' (' + (R.repDelta >= 0 ? '+' : '') + R.repDelta.toFixed(1) + ')', PANEL.x + 40, PANEL.y + 352, C.sub);
    const x = PANEL.x + 420;
    label('인기도 ' + Math.round(R.popularity), x, PANEL.y + 86, C.ink, 'left', 18);
    const names = { sales: '장사', satisfaction: '손님 만족', soldOut: '품절', exchange: '환전 지연', dirty: '지저분함', claims: '항의', fade: '잊힘' };
    Object.keys(names).filter((k) => Math.abs(R.popReasons[k]) >= 0.05).forEach((k, i) => {
      const v = R.popReasons[k], y = PANEL.y + 114 + i * 24;
      label(names[k], x, y, C.sub);
      label((v >= 0 ? '+' : '') + v.toFixed(1), x + 280, y, v >= 0 ? C.blue : C.alert, 'right');
    });
    const miss = st.lastMissed || [];
    label('손님이 찾았지만 없던 취향', x, PANEL.y + 296, C.ink);
    label(miss.length ? miss.join(', ') : '없음', x, PANEL.y + 320, C.alert);
    if (R.rankUp) label('축하해요! ' + (6 - R.rankUp) + '랭크로 올랐어요!', 480, PANEL.y + 388, C.blue, 'center', 22);
    if (R.champion) label('전국 1위 달성!', 480, PANEL.y + 388, C.alert, 'center', 28);
    if (st.bankrupt) {
      label('돈이 모두 떨어졌어요…', 480, PANEL.y + 388, C.alert, 'center', 22);
      btn(360, PANEL.y + PANEL.h - 58, 240, 44, '처음부터 다시', () => { State.data.sim = null; enter(); }, { style: 'danger', size: 18 });
    } else {
      btn(360, PANEL.y + PANEL.h - 58, 240, 44, '가게 정리하러 가기', () => { phase = 'build'; ShopView.autoPlace(st); }, { style: 'primary', size: 18 });
    }
  }

  function draw(ctx, now, W, H, OX) {
    st = State.data.sim;
    update(now);
    // 어제 손님이 찾던 취향(많은 순 3개)을 기억해 둔다
    if (phase === 'result' && result) st.lastMissed = Object.keys(result.missed).filter((k) => result.missed[k] > 0).sort((a, b) => result.missed[b] - result.missed[a]).slice(0, 3);
    UI.rect(0, 0, W, H, '#cfe0ef');
    ctx.save();
    ctx.translate(OX, 0);
    if (phase === 'open') drawOpen(ctx, now);
    else if (phase === 'result') drawResult();
    else {
      drawBuild(ctx);
      if (popup === 'shop') drawShopPopup();
      else if (popup === 'order') drawOrderPopup();
      else if (popup === 'plan') drawPlanPopup();
    }
    if (msg && now < msg.until) {
      UI.chip({ x: 250, y: 66, w: 460, h: 32 });
      label(msg.text, 480, 82, C.ink, 'center');
    }
    ctx.restore();
  }

  return { enter, leave, escape, draw, press, move, release };
})();
