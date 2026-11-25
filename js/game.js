// 가게 화면: 건축 화면(영업 전 준비: 배치·상점·발주·기계 설정) ↔ 영업 화면(실시간) → 정산.
// 계산은 전부 Sim(js/sim.js), 바닥 그림은 ShopView(js/shopview.js). 좌표는 가운데 960 영역 기준.
const Game = (function () {
  const C = CFG.COLOR;
  const MIN_PER_SEC = (CFG.SIM.CLOSE - CFG.SIM.OPEN) * 60 / 120; // 1배속: 하루 영업을 120초에
  const DOW = ['월', '화', '수', '목', '금', '토', '일'];
  const WEATHER = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈' };
  const TASK = { refill: '보충', clean: '청소', exchange: '환전', repair: '수리' };
  const BALK = { nothing: '취향이 없네', budget: '돈이 모자라', queue: '줄이 길어', empty: '비었잖아', exchange: '환전이 안 돼' };

  let st = null;          // 시뮬레이션 상태(State.data.sim)
  let phase = 'build';    // build | open | result
  let popup = null;       // null | shop | order | plan
  let sel = null;         // 선택한 것의 key(ShopView.things)
  let drag = null;        // 끌고 있는 것: {t, dx, dy, x, y, sx, sy, moved}
  let toasts = [], toast = null; // 도전과제 알림
  let dayAch = [];
  let placing = null;     // 창고에서 꺼내 놓는 중: {key, x, y, armed}
  let sellAsk = null;     // 한 번 더 눌러야 팔리는 대상(key)
  let itemPage = 0, stockTab = 'doll';
  let dev = false, devAuto = false; // 개발자 모드(F2)
  let scope = 'one';      // 난이도·가격 적용 범위
  let tab = 'machine';    // 상점 탭
  let page = 0;
  let cart = {};
  let cartPlans = null;   // 추천 담기로 채운 장바구니라면 그때의 진열 계획(주문할 때 적용)
  let orderSize = 'all', orderFirst = null, stockSel = null, itemSel = null;
  let msg = null;         // {text, until}
  let day = null, snapshot = null, speed = 1, paused = false, acc = 0, last = null;
  let pops = [], today = null, result = null;
  let clockNow = 0;

  const won = (n) => (Math.round(n) || 0).toLocaleString('ko-KR') + '원';
  const man = (n) => (Math.abs(n) >= 10000 ? (Math.round(n / 1000) / 10).toLocaleString('ko-KR') + '만' : Math.round(n).toLocaleString('ko-KR'));
  const mname = (m) => DATA.MACHINES[m.type].name.replace(' 뽑기 기계', '') + ' #' + m.id;
  const say = (text) => { msg = { text, until: clockNow + 2.2 }; };
  const save = () => State.save();
  // 구매 결과를 알려 주고 저장한다
  function done(r, okText) {
    if (r.ok) { Sound.sfx('confirm'); if (okText) say(okText); ShopView.autoPlace(st); achieve(Sim.checkAchievements(st)); save(); } else { Sound.sfx('buzz'); say(r.why); }
  }
  // 도전과제 보상 설명
  function rewardText(r) {
    if (r.money) return '상금 ' + man(r.money) + '원';
    if (r.doll) return '인형 해금: ' + Sim.info.doll(r.doll).name;
    return '소품: ' + Sim.decorDef(r.decor).name;
  }
  function achieve(list) {
    if (!list.length) return;
    list.forEach((a) => toasts.push(a));
    if (phase !== 'open') ShopView.autoPlace(st); // 보상 소품을 빈 곳에 놓는다(영업 중에는 마감 뒤에: 손님 길이 바뀌지 않게)
  }
  const findThing = (key) => ShopView.things(st).find((t) => t.key === key);
  const selectedMachine = () => { const t = sel && findThing(sel); return t && t.kind === 'machine' ? t.ref : null; };

  function enter() {
    const d = State.data;
    if (!d.sim || d.sim.v !== 2) d.sim = Sim.newGame(d.playerName, d.shopName, null, { stored: true }); // 개업 물품은 창고에
    st = Sim.upgradeState(d.sim);
    ShopView.autoPlace(st);
    toasts = []; toast = null;
    placing = null; sellAsk = null; itemPage = 0; stockTab = 'doll'; orderSize = 'all'; stockSel = null; itemSel = null;
    phase = 'build'; popup = null; sel = null; drag = null; day = null; result = null; msg = null; last = null; cart = {};
    save();
  }
  // 화면을 나갈 때: 영업 중이었다면 그날 시작 전 상태로 되돌린다.
  function leave() {
    if (phase === 'open' && snapshot) State.data.sim = JSON.parse(snapshot);
    day = null; phase = 'build'; popup = null; drag = null;
  }
  function escape() { if (placing) { placing = null; return true; } if (popup) { popup = null; return true; } return false; }

  // ---------- 설치물 ----------
  const thingName = (t) => (t.kind === 'machine' ? mname(t.ref) : t.kind === 'bin' ? (t.ref.big ? '대형 쓰레기통' : '쓰레기통')
    : t.kind === 'decor' ? t.def.name : DATA.EQUIPMENT[t.ref].name);
  // 팔 때 받는 돈(팔 수 없으면 0)
  function sellPrice(t) {
    const R = CFG.SIM.DECOR.SELL;
    if (t.kind === 'machine') return DATA.MACHINES[t.ref.type].price * 0.4;
    if (t.kind === 'bin') return DATA.EQUIPMENT[t.ref.big ? 'bin' : 'smallbin'].price * R;
    if (t.kind === 'decor') return t.def.locked ? 0 : t.def.price * R;
    return DATA.EQUIPMENT[t.ref].price * R;
  }
  function sellThing(t) {
    if (sellAsk !== t.key) { sellAsk = t.key; say('한 번 더 누르면 팔아요'); return; }
    sellAsk = null;
    const r = t.kind === 'machine' ? Sim.sellMachine(st, t.ref.id) : t.kind === 'bin' ? Sim.sellBin(st, t.ref.uid)
      : t.kind === 'decor' ? Sim.sellDecor(st, t.ref.uid) : Sim.sellEquipment(st, t.ref);
    if (r.ok) sel = null;
    done(r, r.ok ? '팔았어요 +' + won(r.gain) : '');
  }
  function storeThing(t) {
    if (t.kind === 'machine') Sim.storeMachine(st, t.ref.id); else { t.holder.stored = true; t.holder.pos = null; }
    sel = null; sellAsk = null; Sound.sfx('confirm'); say(thingName(t) + '을(를) 창고에 넣었어요'); save();
  }
  // 90도 돌리기(기계, 바닥 소품). 놓으려는 중이면 그 물품을, 아니면 고른 것을 돌린다.
  function rotate() {
    if (phase !== 'build' || popup) return;
    const t = placing ? placingThing() : sel && findThing(sel);
    if (!t) return;
    if (!ShopView.canRotate(t)) { Sound.sfx('buzz'); say('이건 돌릴 수 없어요'); return; }
    const old = t.holder.rot || 0;
    if (placing) { t.holder.rot = (old + 1) % 4; Sound.sfx('click'); return; }
    for (let i = 1; i < 4; i++) { // 지금 자리에서 놓을 수 있는 다음 방향
      t.holder.rot = (old + i) % 4;
      if (ShopView.canPlace(st, t, t.holder.pos.x, t.holder.pos.y)) { Sound.sfx('confirm'); save(); return; }
    }
    t.holder.rot = old; Sound.sfx('buzz'); say('여기서는 돌릴 자리가 없어요');
  }
  function startPlacing(key) {
    const g = ShopView.geom(st.shopLevel);
    placing = { key, x: g.x + g.w / 2, y: g.y + g.h / 2, armed: false };
    popup = null; sel = null; sellAsk = null;
  }
  const placingThing = () => placing && ShopView.stored(st).find((t) => t.key === placing.key);
  function placingCell(t) {
    const g = ShopView.geom(st.shopLevel);
    const d = ShopView.dims(t);
    return { x: Math.floor((placing.x - g.x) / ShopView.CW - (d.w - 1) / 2), y: t.wall ? -1 : Math.floor((placing.y - g.y) / ShopView.CH - (d.h - 1) / 2) };
  }
  function tryPlace() {
    const t = placingThing(), c = t && placingCell(t);
    if (!t) { placing = null; return; }
    if (t.kind === 'machine') { const can = Sim.canInstall(st, t.ref); if (!can.ok) { Sound.sfx('buzz'); say(can.why); placing = null; return; } }
    if (!ShopView.canPlace(st, t, c.x, c.y)) { Sound.sfx('buzz'); say('여기에는 놓을 수 없어요'); return; }
    if (t.kind === 'machine') Sim.installMachine(st, t.ref.id); else t.holder.stored = false;
    if (t.kind === 'machine' && Object.keys(t.ref.plan).length && !Sim.info.loadQty(t.ref)) Sim.refill(st, t.ref); // 진열한 적이 있는 기계는 다시 채운다
    t.holder.pos = c; placing = null; sel = null; // 바로 다음 물품을 꺼낼 수 있게 창고 목록을 다시 보여 준다
    Sound.sfx('confirm'); achieve(Sim.checkAchievements(st)); save();
  }

  // ---------- 튜토리얼 ----------
  const installed = () => Sim.info.placed(st).length;
  const TUTORIAL = [
    { text: '개업 준비를 해요! 창고에 소형 기계 2대, 쓰레기통, 인형을 넣어 두었어요.', next: true },
    { text: '오른쪽 [창고 물품]에서 소형 기계를 누른 뒤, 바닥을 눌러 놓아 주세요.', done: () => installed() >= 1, target: { x: 732, y: 74, w: 210, h: 424 } },
    { text: '좋아요! 남은 소형 기계도 같은 방법으로 놓아 주세요.', done: () => installed() >= Math.min(2, st.machines.length), target: { x: 732, y: 74, w: 210, h: 424 } },
    { text: '손님 쓰레기를 모을 쓰레기통도 놓아 주세요. 기계와 쓰레기통은 꼭 하나 이상 있어야 해요.', done: () => Sim.info.placedBins(st).length >= 1, target: { x: 732, y: 74, w: 210, h: 424 } },
    { text: '[추천 진열]을 눌러 창고의 인형을 기계에 채워 주세요.', done: () => Sim.info.placed(st).some((m) => Sim.info.loadQty(m) > 0), target: { x: 374, y: 514, w: 120, h: 46 } },
    { text: '기계를 누르면 난이도, 가격, 진열을 바꿔요. 끌면 옮기고, 창고에 다시 넣을 수도 있어요.', next: true },
    { text: '준비 끝! [영업 시작]을 눌러 주세요.', done: () => phase === 'open', target: { x: 742, y: 514, w: 198, h: 46 } },
    { text: '일이 생기면 말풍선이나 오른쪽 목록을 눌러요. 사장님이 가서 처리해요. 바닥의 쓰레기도 눌러요.', next: true, pause: true },
  ];
  const tutorialStep = () => (typeof st.tutorial === 'number' ? TUTORIAL[st.tutorial] : null);
  function advanceTutorial() { st.tutorial++; if (st.tutorial >= TUTORIAL.length) st.tutorial = 'done'; save(); }
  function skipTutorial() {
    if (phase === 'build') {
      ShopView.stored(st).forEach((t) => { if (t.kind === 'machine') Sim.installMachine(st, t.ref.id); else if (t.kind === 'bin') t.holder.stored = false; });
      ShopView.autoPlace(st); Sim.autoPrep(st, { order: false }); placing = null;
    }
    st.tutorial = 'done'; paused = false; save();
  }
  function drawTutorial(now) {
    let s = tutorialStep();
    while (s && s.done && s.done()) { advanceTutorial(); s = tutorialStep(); if (s && s.pause) paused = true; }
    if (!s || popup || phase === 'result' || (s.pause && phase !== 'open')) return;
    if (s.target && !placing) { // 눌러야 할 곳을 깜빡이는 테두리로
      const t = s.target, w = 3 + Math.floor(now * 3) % 2 * 2;
      [[t.x - w, t.y - w, t.w + w * 2, w], [t.x - w, t.y + t.h, t.w + w * 2, w], [t.x - w, t.y, w, t.h], [t.x + t.w, t.y, w, t.h]].forEach((a) => UI.rect(a[0], a[1], a[2], a[3], '#ffb300'));
    }
    const b = { x: 24, y: 444, w: 682, h: 52 };
    UI.panel(b, '#fff6cf', 3);
    const lines = UI.wrap(s.text, s.next ? 470 : 550, 14);
    lines.slice(0, 2).forEach((l, i) => label(l, b.x + 14, b.y + (lines.length > 1 ? 16 + i * 21 : 26)));
    btn(b.x + b.w - 96, b.y + 9, 84, 34, '건너뛰기', skipTutorial);
    if (s.next) btn(b.x + b.w - 188, b.y + 9, 82, 34, '다음', () => { const wasPause = s.pause; advanceTutorial(); if (wasPause) paused = false; }, { style: 'primary' });
  }

  // ---------- 영업 ----------
  function openShop() {
    ShopView.autoPlace(st);
    const can = Sim.canOpen(st);
    if (!can.ok) { Sound.sfx('buzz'); say(can.why); return; }
    placing = null;
    save();
    snapshot = JSON.stringify(st);
    day = Sim.openDay(st, { mode: 'manual' });
    devAuto = false;
    dayAch = [];
    phase = 'open'; popup = null; sel = null; speed = 1; paused = false; acc = 0; last = null;
    pops = []; today = { revenue: 0, visitors: 0, wins: 0 };
    Actors.reset(st);
    Sound.sfx('doorbell');
  }
  function finishDay() {
    result = day.close();
    achieve(result.achieved);
    result.achieved = dayAch.concat(result.achieved);
    day = null; phase = 'result'; snapshot = null;
    Sound.sfx(result.rankUp ? 'fanfare' : 'prize');
    save();
  }
  function skip() {
    const r = Sim.skipDay(st);
    if (!r.ok) { say(r.why); Sound.sfx('buzz'); return; }
    result = r.result; phase = 'result'; popup = null; achieve(result.achieved); save();
  }
  function pop(x, y, text, color) { if (pops.length < 24) pops.push({ x, y, text, color, t: clockNow }); }

  function onEvents(events) {
    const g = ShopView.geom(st.shopLevel);
    const mach = (id) => st.machines.find((m) => m.id === id);
    events.forEach((e) => {
      const a = Actors.onEvent(e);
      if (e.type === 'arrive') today.visitors++;
      else if (e.type === 'play' || e.type === 'win') {
        const m = mach(e.m);
        if (!m) return;
        today.revenue += m.price;
        if (e.type === 'win') { today.wins++; const p = ShopView.standPoint(g, m); pop(p.x, p.y - 60, '획득!', '#2f9e5b'); Sound.sfx('prize'); }
      } else if (e.type === 'balk') {
        if (a) pop(a.x, a.y - 40, BALK[e.why] || '…', C.alert);
      } else if (e.type === 'refill') {
        if (e.subs && e.subs.length) say(Sim.info.doll(e.subs[0]).name + '(으)로 대신 채웠어요');
      } else if (e.type === 'task') {
        if (speed > 1) { speed = 1; say('할 일이 생겨 1배속으로 바꿨어요'); }
        Sound.sfx('notif');
      }
    });
  }
  // 할 일을 누르면 주인공에게 맡긴다(직접 걸어가서 처리한다)
  function order1(k) {
    if (k.noStock) { Sound.sfx('buzz'); say('창고에 채울 인형이 없어요'); return; }
    if (Actors.enqueue(k)) Sound.sfx('click');
  }
  const hooks = {
    sfx: (name) => Sound.sfx(name),
    noStock: () => { Sound.sfx('buzz'); say('창고에 채울 인형이 없어요'); },
    done: (r, j) => {
      if (r.ok) Sound.sfx(j.type === 'repair' ? 'sparkle' : 'confirm');
      else if (j.type === 'refill') { Sound.sfx('buzz'); say('창고에 채울 인형이 없어요'); }
      onEvents(r.events);
    },
  };
  function update(now) {
    const dt = last == null ? 0 : Math.max(0, Math.min(0.1, now - last));
    last = now; clockNow = now;
    if (phase !== 'open' || paused) return;
    acc += dt * MIN_PER_SEC * speed;
    if (acc >= 1) {
      const n = Math.floor(acc); acc -= n; onEvents(day.step(n));
      const got = Sim.checkAchievements(st, day.result); dayAch = dayAch.concat(got); achieve(got);
    }
    Actors.update(dt * speed, day, hooks);
    if (day.done()) finishDay();
  }

  // ---------- 건축 화면의 끌어 놓기 ----------
  function press(p) {
    if (dev && inDev(p)) return;
    if (phase === 'open') { // 바닥의 쓰레기를 누르면 주우러 간다
      const id = Actors.litterAt(p);
      if (id != null && Actors.enqueue({ type: 'litter', litter: id })) Sound.sfx('click');
      return;
    }
    if (phase !== 'build' || popup) return;
    if (placing) { if (p.x < 720 && p.y > 60 && p.y < 500) { placing.x = p.x; placing.y = p.y; placing.armed = true; } return; }
    sellAsk = null;
    const g = ShopView.geom(st.shopLevel);
    if (p.x >= g.store.x && p.x <= g.store.x + g.store.w && p.y >= g.store.y && p.y <= g.store.y + g.store.h) { popup = 'stock'; page = 0; Sound.sfx('click'); return; }
    const hit = ShopView.things(st).filter((t) => t.holder.pos).sort((a, b) => ShopView.depth(g, b) - ShopView.depth(g, a)).find((t) => {
      const r = ShopView.rectOf(g, t);
      return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    });
    if (!hit) { if (p.x < 720 && p.y > 60 && p.y < 500) sel = null; return; }
    const r = ShopView.rectOf(g, hit);
    sel = hit.key;
    drag = { t: hit, dx: p.x - r.x, dy: p.y - r.y, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
    Sound.sfx('click');
  }
  function move(p) {
    if (placing && phase === 'build') { placing.x = p.x; placing.y = p.y; return; }
    if (!drag) return;
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
  }
  function dragCell() {
    const g = ShopView.geom(st.shopLevel), t = drag.t;
    const base = ShopView.rectOf(g, t, { x: 0, y: t.wall ? -1 : 0 });
    return { x: Math.round((drag.x - drag.dx - base.x) / ShopView.CW), y: t.wall ? -1 : Math.round((drag.y - drag.dy - base.y) / ShopView.CH) };
  }
  function release() {
    if (placing) { if (placing.armed) { placing.armed = false; tryPlace(); } return; }
    if (!drag) return;
    const s = ShopView.geom(st.shopLevel).store;
    if (drag.moved && drag.x >= s.x - 10 && drag.x <= s.x + s.w + 10 && drag.y >= s.y - 10 && drag.y <= s.y + s.h) { storeThing(drag.t); drag = null; return; }
    if (drag.moved) {
      const c = dragCell();
      if (ShopView.canPlace(st, drag.t, c.x, c.y)) { drag.t.holder.pos = c; Sound.sfx('confirm'); save(); }
      else { Sound.sfx('buzz'); say('여기에는 놓을 수 없어요'); }
    }
    drag = null;
  }

  // ---------- 공통 그리기 ----------
  const btn = (x, y, w, h, label, onClick, o) => UI.button({ x, y, w, h }, label, Object.assign({ style: 'secondary', size: 14, onClick }, o));
  const label = (t, x, y, color, align, size) => UI.text(t, x, y, size || 14, color || C.ink, align || 'left');

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
    ShopView.things(st).filter((t) => t.holder.pos).sort((a, b) => ShopView.depth(g, a) - ShopView.depth(g, b)).forEach((t) => {
      if (drag && drag.moved && drag.t.key === t.key) return;
      ShopView.thing(st, t, ShopView.rectOf(g, t), { selected: sel === t.key });
    });
    if (drag && drag.moved) {
      const c = dragCell(), ok = ShopView.canPlace(st, drag.t, c.x, c.y);
      ShopView.thing(st, drag.t, ShopView.rectOf(g, drag.t, c), { ghost: ok ? 'ok' : 'no' });
    }
    const pt = placingThing();
    if (pt) {
      const c = placingCell(pt);
      if (placing.x < 720) ShopView.thing(st, pt, ShopView.rectOf(g, pt, c), { ghost: ShopView.canPlace(st, pt, c.x, c.y) ? 'ok' : 'no' });
    }
    topBar();
    label('기계 칸 ' + Sim.info.footUsed(st) + ' / ' + CFG.SIM.SHOP[st.shopLevel].slots, 560, 18);
    label('창고 ' + Sim.info.stockTotal(st) + ' / ' + CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, 560, 41);
    label('유행 ' + st.trend.taste + ' → 다음 ' + st.trend.next, 700, 18, '#8a4fc0');
    label('예상 손님 ' + Sim.forecast(st) + '명', 700, 41, C.sub);
    sidePanel();
    const bar = (x, w, text, onClick, o) => btn(x, 514, w, 46, text, onClick, Object.assign({ size: 18 }, o));
    bar(20, 106, '상점', () => { popup = 'shop'; page = 0; });
    bar(138, 106, '발주', () => openOrder());
    bar(256, 106, shortage().length ? '창고 !' : '창고', () => { popup = 'stock'; page = 0; }, shortage().length ? { style: 'danger' } : {});
    bar(374, 120, '추천 진열', () => { Sim.autoPrep(st, { order: false }); say('가진 인형으로 다시 진열했어요'); achieve(Sim.checkAchievements(st)); save(); });
    if (st.staff) bar(506, 120, '건너뛰기', skip, { style: Sim.canSkip(st).ok ? 'secondary' : 'soft' });
    bar(742, 198, '영업 시작', openShop, { style: Sim.canOpen(st).ok ? 'primary' : 'soft', size: 22 });
  }
  const loadedTotal = (id) => st.machines.reduce((n, m) => n + (m.load[id] ? m.load[id].qty : 0), 0);
  const stockQty = (id) => (st.stock[id] ? st.stock[id].qty : 0);
  const comingQty = (id) => st.incoming.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);
  // 지난 영업만큼 뽑히면 모자랄 인형
  const shortage = () => Object.keys(st.used).filter((id) => stockQty(id) + loadedTotal(id) + comingQty(id) < st.used[id]);

  function sidePanel() {
    const p = { x: 732, y: 74, w: 210, h: 424 };
    UI.panel(p, C.white, 3);
    const t = sel && findThing(sel);
    const m = t && t.kind === 'machine' ? t.ref : null;
    const mid = p.x + p.w / 2;
    const actions = (item) => { // 창고에 넣기 / 팔기
      const y = p.y + p.h - 50, price = sellPrice(item), canStore = true, canSell = price > 0;
      if (canStore) btn(p.x + 10, y, canSell ? 90 : p.w - 20, 36, canSell ? '창고로' : '창고에 넣기', () => storeThing(item));
      if (canSell) btn(p.x + (canStore ? 106 : 10), y, canStore ? 94 : p.w - 20, 36, sellAsk === item.key ? '한 번 더' : '팔기 ' + man(price), () => sellThing(item), { style: sellAsk === item.key ? 'danger' : 'secondary' });
    };
    if (placing) {
      const item = placingThing();
      label('설치하기', mid, p.y + 30, C.ink, 'center', 18);
      if (item) UI.wrap(thingName(item), p.w - 20, 14).forEach((s, i) => label(s, mid, p.y + 70 + i * 22, C.blue, 'center'));
      ['놓을 바닥을', '눌러 주세요.', '초록색이면 놓을 수', '있어요.'].forEach((s, i) => label(s, mid, p.y + 130 + i * 24, C.sub, 'center'));
      if (item && ShopView.canRotate(item)) btn(p.x + 12, p.y + p.h - 94, p.w - 24, 36, '돌리기 (R)', rotate);
      btn(p.x + 12, p.y + p.h - 50, p.w - 24, 36, '취소', () => { placing = null; });
      return;
    }
    if (t && t.kind === 'fix') {
      const e = DATA.EQUIPMENT[t.ref];
      UI.wrap(e.name, p.w - 20, 18).forEach((s, i) => label(s, mid, p.y + 30 + i * 24, C.ink, 'center', 18));
      UI.wrap(e.desc, p.w - 24, 14).concat(['', '끌어서 옮길 수 있어요']).forEach((s, i) => label(s, mid, p.y + 84 + i * 24, C.sub, 'center'));
      actions(t);
      return;
    }
    if (t && t.kind === 'bin') {
      label(thingName(t), mid, p.y + 30, C.ink, 'center', 18);
      ['손님 쓰레기를 모아요.', '', '많이 놓거나 큰 것을', '놓으면 청소할 일이', '줄어들어요.'].forEach((s, i) => label(s, mid, p.y + 70 + i * 24, C.sub, 'center'));
      actions(t);
      return;
    }
    if (t && t.kind === 'decor') {
      const d = t.def;
      UI.wrap(d.name, p.w - 20, 18).forEach((s, i) => label(s, mid, p.y + 30 + i * 24, C.ink, 'center', 18));
      label((d.wall ? '벽 소품' : '바닥 소품') + ' · 매력 ' + d.charm, mid, p.y + 90, C.sub, 'center');
      label('가게 매력 ' + Sim.charmRaw(st).toFixed(1) + ' / ' + Sim.charmCap(st), mid, p.y + 118, C.blue, 'center');
      label(d.locked ? '도전과제 기념품' : '같은 소품은 효과가 줄어요', mid, p.y + 146, C.sub, 'center');
      if (ShopView.canRotate(t)) btn(p.x + 12, p.y + p.h - 94, p.w - 24, 36, '돌리기 (R)', rotate);
      actions(t);
      return;
    }
    if (!m) { // 아무것도 고르지 않았을 때: 창고 물품
      const items = ShopView.stored(st), per = 6, pages = Math.max(1, Math.ceil(items.length / per));
      itemPage = Math.min(itemPage, pages - 1);
      label('창고 물품 ' + items.length, mid, p.y + 24, C.ink, 'center', 18);
      if (!items.length) ['창고에 넣어 둔', '물품이 없어요.', '', '상점에서 사면', '여기에 들어와요.', '', '놓은 것은 눌러서', '설정하거나 옮겨요.'].forEach((s, i) => label(s, mid, p.y + 70 + i * 24, C.sub, 'center'));
      items.slice(itemPage * per, itemPage * per + per).forEach((it, i) => itemTile(p.x + 12 + (i % 2) * 96, p.y + 46 + Math.floor(i / 2) * 96, 90, it, () => startPlacing(it.key)));
      if (pages > 1) btn(p.x + 12, p.y + 336, p.w - 24, 28, '더 보기 ' + (itemPage + 1) + ' / ' + pages, () => { itemPage = (itemPage + 1) % pages; });
      label('가게 매력 ' + Sim.charmRaw(st).toFixed(1) + ' / ' + Sim.charmCap(st), mid, p.y + p.h - 50, C.blue, 'center');
      label('설치 ' + Sim.info.placed(st).length + '대', mid, p.y + p.h - 24, C.sub, 'center');
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
    btn(p.x + 12, p.y + 334, p.w - 24, 34, '돌리기 (R)', rotate);
    actions(t);
  }

  // ---------- 팝업 ----------
  const PANEL = { x: 100, y: 70, w: 760, h: 470 };
  const BIG = { x: 30, y: 66, w: 900, h: 494 }; // 인형 발주·창고처럼 목록이 많은 창
  function popupFrame(title, titleX, f) {
    f = f || PANEL;
    UI.block({ x: -600, y: 0, w: 2200, h: 576 });
    UI.rect(-600, 59, 2200, 517, C.scrim);
    UI.panel(f, C.white);
    UI.text(title, titleX || 480, f.y + 30, 22, C.ink);
    UI.hline(f.x + 20, f.y + 54, f.w - 40);
    btn(f.x + f.w - 96, f.y + 12, 80, 34, '닫기', () => { popup = null; });
  }
  function pager(count, per, f) {
    f = f || PANEL;
    const pages = Math.max(1, Math.ceil(count / per));
    page = Math.min(page, pages - 1);
    if (pages > 1) {
      btn(f.x + 20, f.y + f.h - 50, 60, 34, '이전', () => { page = (page + pages - 1) % pages; });
      label((page + 1) + ' / ' + pages, f.x + 110, f.y + f.h - 33, C.sub, 'center');
      btn(f.x + 140, f.y + f.h - 50, 60, 34, '다음', () => { page = (page + 1) % pages; });
    }
  }

  // ---------- 타일과 작은 표시 ----------
  // 정사각 타일: o = {selected, alert, draw(x, y)}
  function tile(x, y, size, onClick, o) {
    UI.button({ x, y, w: size, h: size }, '', { style: o.selected ? 'soft' : 'secondary', onClick, draw: (bx, by) => {
      o.draw(bx, by);
      const edge = o.selected ? C.blue : o.alert ? C.alert : null;
      if (edge) [[0, 0, size, 3], [0, size - 3, size, 3], [0, 0, 3, size], [size - 3, 0, 3, size]].forEach((a) => UI.rect(bx + a[0], by + a[1], a[2], a[3], edge));
    } });
  }
  // 타일 아래쪽의 이름(길면 두 줄). cy: 두 줄 영역의 가운데
  function tileName(text, cx, cy, w) {
    const lines = UI.wrap(text, w, 14).slice(0, 2);
    lines.forEach((l, i) => label(l, cx, cy + (i - (lines.length - 1) / 2) * 16, C.ink, 'center'));
  }
  function itemTile(x, y, size, t, onClick, o) {
    tile(x, y, size, onClick, Object.assign({ draw: (bx, by) => {
      Icons.draw(Icons.keyOf(t), bx + size / 2 - 24, by + 5, 2);
      tileName(thingName(t), bx + size / 2, by + size - 20, size - 6);
    } }, o));
  }
  // 색 딱지. 다음 딱지를 놓을 x를 돌려준다.
  function chip(x, y, text, fill, color) {
    const w = Math.ceil(UI.measure(text, 14)) + 10;
    UI.rect(x, y, w, 18, fill);
    label(text, x + w / 2, y + 9, color || C.ink, 'center');
    return x + w + 4;
  }
  const SIZE_NAME = { S: '소형', M: '중형', L: '대형', XL: '초대형' };
  function dollChips(x, y, d) {
    let cx = chip(x, y, SIZE_NAME[d.size], C.soft);
    d.taste.forEach((t) => { cx = chip(cx, y, t, ShopView.TASTE_COLOR[t] || C.soft); });
  }
  // 창고 사용량 막대. extra: 장바구니에 담은 수
  function capacityBar(x, y, w, extra) {
    const cap = CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, have = Sim.info.stockTotal(st), coming = Sim.info.incomingTotal(st);
    const total = have + coming + (extra || 0), px = (n) => Math.min(w, Math.round(w * n / cap));
    UI.framed({ x, y, w, h: 12 }, C.soft, 2);
    UI.rect(x, y, px(total), 12, total > cap ? C.alert : '#ffb300');
    UI.rect(x, y, px(have + coming), 12, C.blueLight);
    UI.rect(x, y, px(have), 12, C.blue);
    label('창고 ' + total + ' / ' + cap, x + w / 2, y + 28, total > cap ? C.alert : C.sub, 'center');
  }

  function drawShopPopup() {
    popupFrame('상점', 600); // 왼쪽의 탭 버튼과 겹치지 않게
    [['machine', '기계'], ['equip', '설비'], ['decor', '소품'], ['grow', '확장·직원']].forEach(([k, t], i) => btn(PANEL.x + 20 + i * 104, PANEL.y + 12, 96, 34, t, () => { tab = k; page = 0; }, { style: tab === k ? 'primary' : 'secondary' }));
    const rows = [];
    const rankLock = (r) => (r > st.rank ? (6 - r) + '랭크부터' : null);
    if (tab === 'machine') {
      Object.keys(DATA.MACHINES).forEach((k) => {
        const d = DATA.MACHINES[k];
        rows.push({ name: d.name, desc: '칸 ' + d.footprint + ' · 넣는 크기 ' + d.sizes.join(' ') + ' · 하루 전기 ' + man(d.power), price: d.price, lock: rankLock(d.rank),
          buy: () => done(Sim.buyMachine(st, k, { store: true }), d.name + ' 구입! 창고에 넣었어요') });
      });
    } else if (tab === 'decor') {
      DATA.DECOR.filter((d) => !d.locked).forEach((d) => {
        const owned = st.decors.filter((o) => o.id === d.id).length;
        rows.push({ name: d.name + (owned ? ' (' + owned + '개)' : ''), desc: (d.wall ? '벽' : '바닥 ' + d.width + '칸') + ' · 매력 ' + d.charm, price: d.price,
          lock: d.champion && !st.champion ? '1위 달성 후' : rankLock(d.rank),
          buy: () => done(Sim.buyDecor(st, d.id, { store: true }), d.name + ' 구입! 창고에 넣었어요') });
      });
    } else if (tab === 'equip') {
      Object.keys(DATA.EQUIPMENT).filter((k) => !DATA.EQUIPMENT[k].perMachine).forEach((k) => {
        const e = DATA.EQUIPMENT[k];
        const item = k !== 'globalpay'; // 놓는 물품은 창고로
        rows.push({ name: e.name, desc: e.desc, price: e.price, lock: st.equip[k] ? '보유 중' : rankLock(e.rank), buy: () => done(Sim.buyEquipment(st, k, null, { store: true }), e.name + (item ? ' 구입! 창고에 넣었어요' : ' 설치!')) });
      });
    } else {
      const s = CFG.SIM.SHOP[st.shopLevel + 1], w = CFG.SIM.WAREHOUSE[st.warehouseLevel + 1], S = CFG.SIM.STAFF;
      if (s) rows.push({ name: '가게 확장: ' + s.name, desc: '기계 칸 ' + s.slots + ' · 월 임대료 ' + man(s.rent), price: s.cost, lock: rankLock(s.rank), buy: () => done(Sim.expandShop(st), '가게를 넓혔어요!') });
      if (w) rows.push({ name: '창고 확장: ' + w.cap + '개', desc: '하루 유지비 ' + man(w.upkeep), price: w.cost, buy: () => done(Sim.expandWarehouse(st), '창고를 넓혔어요') });
      rows.push({ name: '직원 고용', desc: '하루 월급 ' + man(S.wage) + ' · 건너뛰기가 열려요', price: 0, lock: st.staff ? '근무 중' : rankLock(S.rank), buy: () => done(Sim.hireStaff(st), '직원이 들어왔어요') });
    }
    const per = 5;
    pager(rows.length, per);
    if (tab === 'decor') label('가게 매력 ' + Sim.charmRaw(st).toFixed(1) + ' / ' + Sim.charmCap(st) + '  (하루 인기도 +' + Sim.charm(st).toFixed(1) + ')', PANEL.x + PANEL.w - 30, PANEL.y + PANEL.h - 32, C.blue, 'right');
    rows.slice(page * per, page * per + per).forEach((r, i) => {
      const y = PANEL.y + 70 + i * 64;
      label(r.name, PANEL.x + 30, y + 12, C.ink, 'left', 18);
      label(r.desc, PANEL.x + 30, y + 38, C.sub);
      label(r.price ? won(r.price) : '', PANEL.x + 600, y + 25, r.price > st.money ? C.alert : C.ink, 'right', 18);
      btn(PANEL.x + 620, y + 6, 120, 40, r.lock || '구입', r.buy, { style: 'primary', disabled: !!r.lock });
      UI.hline(PANEL.x + 20, y + 54, PANEL.w - 40);
    });
  }

  function openOrder(id) {
    popup = 'order'; page = 0; cart = {}; cartPlans = null; orderSize = 'all';
    orderFirst = id || null;
    if (id) cart[id] = 10;
  }
  const trendy = (d) => d.taste.indexOf(st.trend.taste) >= 0;
  function orderCard(x, y, d) {
    const W = 212, H = 174, q = cart[d.id] || 0;
    const have = stockQty(d.id) + loadedTotal(d.id), coming = comingQty(d.id), used = st.used[d.id] || 0, low = shortage().indexOf(d.id) >= 0;
    UI.framed({ x, y, w: W, h: H }, q ? '#eaf4fd' : C.white, 2, q ? C.blue : C.edge);
    UI.rect(x + 8, y + 8, 50, 50, C.soft);
    ShopView.dollIcon(x + 15, y + 15, d, 5);
    const name = UI.wrap(d.name, W - 74, 14).slice(0, 2);
    name.forEach((l, i) => label(l, x + 66, y + (name.length > 1 ? 18 + i * 17 : 22)));
    let cx = x + 66;
    if (trendy(d)) cx = chip(cx, y + 42, '유행', '#e6d3f5', '#6a2f9f');
    if (low) cx = chip(cx, y + 42, '부족', C.alert, C.white);
    if (d.special) chip(cx, y + 42, '한정', '#ffd84a');
    dollChips(x + 8, y + 66, d);
    const unit = Sim.unitCost(st, d.id, Math.max(1, q)), off = unit < Sim.unitCost(st, d.id, 1);
    label('개당 ' + won(unit) + (off ? ' (할인)' : ''), x + 8, y + 100, off ? C.blue : C.ink);
    label('가진 수 ' + have + (coming ? ' (+' + coming + ')' : '') + (used ? ' · 소진 ' + used : ''), x + 8, y + 119, low ? C.alert : C.sub);
    const add = (n) => { cart[d.id] = Math.max(0, q + n); if (!cart[d.id]) delete cart[d.id]; };
    const by = y + H - 40;
    btn(x + 8, by, 40, 32, '-10', () => add(-10), { disabled: !q });
    btn(x + 52, by, 34, 32, '-', () => add(-1), { disabled: !q });
    label(String(q), x + 107, by + 16, q ? C.blue : C.sub, 'center', 22);
    btn(x + 128, by, 34, 32, '+', () => add(1));
    btn(x + 166, by, 40, 32, '+10', () => add(10));
  }
  function drawOrderPopup() {
    popupFrame('인형 발주', 105, BIG);
    const all = DATA.DOLLS.filter((d) => Sim.orderable(st, d));
    const sizes = ['all'].concat(['S', 'M', 'L', 'XL'].filter((z) => all.some((d) => d.size === z)));
    sizes.forEach((z, i) => btn(BIG.x + 160 + i * 86, BIG.y + 12, 78, 34, z === 'all' ? '전체' : SIZE_NAME[z], () => { orderSize = z; page = 0; }, { style: orderSize === z ? 'primary' : 'secondary' }));
    const short = shortage();
    const score = (d) => (d.id === orderFirst ? 4 : 0) + (short.indexOf(d.id) >= 0 ? 2 : 0) + (trendy(d) ? 1 : 0);
    const list = all.filter((d) => orderSize === 'all' || d.size === orderSize).sort((a, b) => score(b) - score(a));
    const per = 6;
    pager(list.length, per, BIG);
    const miss = (st.lastMissed || []).join(', ');
    label('이번 주 유행: ' + st.trend.taste + (miss ? '   ·   손님이 찾던 취향: ' + miss : ''), BIG.x + 20, BIG.y + 74, '#6a2f9f');
    list.slice(page * per, page * per + per).forEach((d, i) => orderCard(BIG.x + 20 + (i % 3) * 220, BIG.y + 90 + Math.floor(i / 3) * 180, d));
    // 장바구니
    const x = BIG.x + 684, w = 196, mid = x + w / 2, top = BIG.y + 66;
    UI.framed({ x, y: top, w, h: BIG.h - 78 }, C.bg, 2, C.edge);
    label('장바구니', mid, top + 20, C.ink, 'center', 18);
    const ids = Object.keys(cart);
    let total = 0, count = 0;
    ids.forEach((id) => { total += Sim.unitCost(st, id, cart[id]) * cart[id]; count += cart[id]; });
    if (!ids.length) ['담은 인형이 없어요.', '[+]로 담거나', '[추천 담기]를 눌러요.'].forEach((t, i) => label(t, mid, top + 62 + i * 20, C.sub, 'center'));
    ids.slice(0, ids.length > 6 ? 5 : 6).forEach((id, i) => {
      const y = top + 46 + i * 24, d = Sim.info.doll(id);
      ShopView.dollIcon(x + 8, y, d, 2);
      label(UI.wrap(d.name, w - 78, 14)[0], x + 28, y + 8);
      label('×' + cart[id], x + w - 8, y + 8, C.blue, 'right');
    });
    if (ids.length > 6) label('외 ' + (ids.length - 5) + '종', mid, top + 46 + 5 * 24 + 8, C.sub, 'center');
    label('합계', x + 8, top + 206, C.sub);
    label(won(total), x + w - 8, top + 206, total > st.money ? C.alert : C.ink, 'right', 18);
    label('남는 돈', x + 8, top + 230, C.sub);
    label(won(st.money - total), x + w - 8, top + 230, total > st.money ? C.alert : C.sub, 'right');
    capacityBar(x + 10, top + 248, w - 20, count);
    label('다음 영업 아침에 도착', mid, top + 296, C.sub, 'center');
    btn(x + 8, top + 314, 114, 34, '추천 담기', () => {
      const r = Sim.recommendOrder(st);
      if (!r.lines.length) { say(installed() ? '지금은 더 주문할 인형이 없어요' : '기계를 먼저 설치하면 추천해 드려요'); return; }
      cart = {}; r.lines.forEach((l) => { cart[l.id] = l.qty; }); cartPlans = r.plans;
    });
    btn(x + 130, top + 314, w - 138, 34, '비우기', () => { cart = {}; cartPlans = null; }, { disabled: !count });
    btn(x + 8, top + 358, w - 16, 48, '주문하기', () => {
      const r = Sim.order(st, Object.keys(cart).map((id) => ({ id, qty: cart[id] })));
      if (r.ok && cartPlans) cartPlans.forEach((p) => { const m = st.machines.find((v) => v.id === p.id); if (m && Object.keys(p.plan).length) { m.plan = p.plan; m.manual = false; } });
      done(r, r.ok ? r.qty + '개 주문 완료. 다음 영업 아침에 와요' : '');
      if (r.ok) { cart = {}; cartPlans = null; }
    }, { style: 'primary', disabled: !count, size: 18 });
  }

  // 진열: 기계에 넣을 인형 수를 정한다(창고에 있는 인형만).
  function drawPlanPopup() {
    const m = selectedMachine();
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
      Object.keys(m.load).forEach((id) => { m.plan[id] = m.load[id].qty; st.stats.shown[id] = 1; });
      achieve(Sim.checkAchievements(st));
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

  // ---------- 창고 ----------
  function stockTabs() {
    [['doll', '인형'], ['item', '물품']].forEach(([k, t], i) => btn(BIG.x + 20 + i * 90, BIG.y + 12, 82, 34, t, () => { stockTab = k; page = 0; sellAsk = null; }, { style: stockTab === k ? 'primary' : 'secondary' }));
  }
  const GRID = { cols: 6, rows: 3, size: 102, gap: 8 };
  const gridPos = (i) => ({ x: BIG.x + 20 + (i % GRID.cols) * (GRID.size + GRID.gap), y: BIG.y + 70 + Math.floor(i / GRID.cols) * (GRID.size + GRID.gap) });
  // 오른쪽의 자세히 보기 칸
  function detailBox() {
    const b = { x: BIG.x + 684, y: BIG.y + 66, w: 196, h: BIG.h - 78 };
    UI.framed(b, C.bg, 2, C.edge);
    return b;
  }
  function drawItemList() {
    popupFrame('창고 물품', null, BIG);
    stockTabs();
    const items = ShopView.stored(st), per = GRID.cols * GRID.rows;
    pager(items.length, per, BIG);
    if (!items.length) { label('창고에 넣어 둔 물품이 없어요.', 480, 290, C.sub, 'center', 18); return; }
    const shown = items.slice(page * per, page * per + per);
    const t = shown.find((v) => v.key === itemSel) || shown[0];
    shown.forEach((it, i) => { const p = gridPos(i); itemTile(p.x, p.y, GRID.size, it, () => { itemSel = it.key; sellAsk = null; }, { selected: it.key === t.key }); });
    const b = detailBox(), mid = b.x + b.w / 2, price = sellPrice(t);
    Icons.draw(Icons.keyOf(t), mid - 48, b.y + 16, 4);
    UI.wrap(thingName(t), b.w - 16, 18).slice(0, 2).forEach((l, i) => label(l, mid, b.y + 134 + i * 22, C.ink, 'center', 18));
    const info = t.kind === 'machine' ? ['기계 칸 ' + t.w, '넣는 크기 ' + DATA.MACHINES[t.ref.type].sizes.map((z) => SIZE_NAME[z]).join('·')]
      : t.kind === 'decor' ? [(t.def.wall ? '벽 소품' : '바닥 소품'), '매력 ' + t.def.charm] : t.kind === 'bin' ? ['손님 쓰레기를', '모아요'] : ['설비'];
    info.forEach((s, i) => UI.wrap(s, b.w - 12, 14).slice(0, 2).forEach((l, j) => label(l, mid, b.y + 184 + i * 40 + j * 18, C.sub, 'center')));
    btn(b.x + 10, b.y + b.h - 102, b.w - 20, 46, '설치', () => startPlacing(t.key), { style: 'primary', size: 18 });
    btn(b.x + 10, b.y + b.h - 46, b.w - 20, 36, sellAsk === t.key ? '한 번 더 눌러 팔기' : price ? '팔기 ' + man(price) : '팔 수 없음', () => sellThing(t), { disabled: !price, style: sellAsk === t.key ? 'danger' : 'secondary' });
  }
  function drawStockPopup() {
    if (stockTab === 'item') { drawItemList(); return; }
    const next = CFG.SIM.WAREHOUSE[st.warehouseLevel + 1];
    popupFrame('창고 인형', null, BIG);
    stockTabs();
    const short = shortage();
    const order = (id) => (short.indexOf(id) >= 0 ? 0 : stockQty(id) ? 1 : 2);
    const ids = DATA.DOLLS.map((d) => d.id).filter((id) => stockQty(id) || comingQty(id) || short.indexOf(id) >= 0).sort((a, b) => order(a) - order(b));
    const per = GRID.cols * GRID.rows;
    pager(ids.length, per, BIG);
    capacityBar(BIG.x + 250, BIG.y + BIG.h - 46, 200);
    if (next) btn(BIG.x + 470, BIG.y + BIG.h - 50, 204, 36, '확장 ' + next.cap + '개 · ' + man(next.cost), () => done(Sim.expandWarehouse(st), '창고를 넓혔어요'));
    if (!ids.length) {
      label('창고가 비었어요.', 360, 270, C.sub, 'center', 18);
      btn(280, 300, 160, 42, '발주하러 가기', () => openOrder(), { style: 'primary' });
      return;
    }
    const shown = ids.slice(page * per, page * per + per);
    const id = shown.indexOf(stockSel) >= 0 ? stockSel : shown[0];
    shown.forEach((v, i) => {
      const p = gridPos(i), d = Sim.info.doll(v), low = short.indexOf(v) >= 0, coming = comingQty(v);
      tile(p.x, p.y, GRID.size, () => { stockSel = v; }, { selected: v === id, alert: low, draw: (bx, by) => {
        ShopView.dollIcon(bx + 10, by + 10, d, 4);
        label(String(stockQty(v)), bx + GRID.size - 10, by + 20, low ? C.alert : C.ink, 'right', 22);
        if (coming) label('+' + coming, bx + GRID.size - 10, by + 42, C.blue, 'right');
        tileName(d.name, bx + GRID.size / 2, by + GRID.size - 26, GRID.size - 8);
      } });
    });
    label('큰 숫자 = 창고에 있는 수 · 파란 + = 입고 예정 · 빨간 테두리 = 모자랄 수 있음', BIG.x + 20, BIG.y + 412, C.sub);
    const d = Sim.info.doll(id), b = detailBox(), mid = b.x + b.w / 2;
    ShopView.dollIcon(mid - 28, b.y + 14, d, 8);
    UI.wrap(d.name, b.w - 12, 14).slice(0, 2).forEach((l, i) => label(l, mid, b.y + 86 + i * 18, C.ink, 'center'));
    let cx = b.x + 8;
    cx = chip(cx, b.y + 122, SIZE_NAME[d.size], C.soft);
    d.taste.forEach((t) => { cx = chip(cx, b.y + 122, t, ShopView.TASTE_COLOR[t] || C.soft); });
    [['창고', stockQty(id)], ['기계에 진열 중', loadedTotal(id)], ['입고 예정', comingQty(id)], ['지난 영업 소진', st.used[id] || 0]].forEach(([k, v], i) => {
      const y = b.y + 160 + i * 24;
      label(k, b.x + 10, y, C.sub);
      label(v + '개', b.x + b.w - 10, y, C.ink, 'right');
    });
    if (short.indexOf(id) >= 0) label('모자랄 수 있어요!', mid, b.y + 262, C.alert, 'center');
    btn(b.x + 10, b.y + 280, b.w - 20, 42, '이 인형 발주', () => openOrder(id), { style: 'primary', disabled: !Sim.orderable(st, d) });
    label('처분(원가의 ' + Math.round(CFG.SIM.STOCK_SELL * 100) + '%)', mid, b.y + 344, C.sub, 'center');
    const sell = (n) => { const r = Sim.sellStock(st, id, n); done(r, r.ok ? r.qty + '개 처분 +' + won(r.gain) : ''); };
    const none = !stockQty(id);
    [['1개', 1], ['10개', 10], ['전부', 0]].forEach(([t, n], i) => btn(b.x + 10 + i * 60, b.y + 360, 56, 36, t, () => sell(n || stockQty(id)), { disabled: none }));
  }

  // ---------- 영업 화면 ----------
  function drawOpen(ctx, now) {
    ShopView.room(st);
    const g = ShopView.geom(st.shopLevel);
    const tasks = day.tasks();
    const downIds = tasks.filter((k) => k.type === 'repair').map((k) => k.m);
    // 놓인 것·쓰레기·손님·주인공을 아래에 있는 것이 앞에 오도록 그린다
    ShopView.things(st).filter((t) => t.holder.pos).map((t) => ({ y: ShopView.depth(g, t) - 12, f: () => ShopView.thing(st, t, ShopView.rectOf(g, t), { down: t.kind === 'machine' && downIds.indexOf(t.ref.id) >= 0 }) }))
      .concat(Actors.drawList(ctx, now))
      .sort((a, b) => a.y - b.y).forEach((o) => o.f());
    // 기계 위: 지금 들어 있는 인형의 종류(취향 아이콘 + 크기)
    ShopView.things(st).filter((t) => t.holder.pos && t.kind === 'machine').sort((a, b) => ShopView.depth(g, a) - ShopView.depth(g, b))
      .forEach((t) => ShopView.badges(t.ref, ShopView.rectOf(g, t)));
    pops = pops.filter((p) => now - p.t < 1.1);
    pops.forEach((p) => UI.text(p.text, p.x, p.y - (now - p.t) * 24, 14, p.color, 'center', C.white, 4));
    // 할 일 말풍선(누르면 처리)
    tasks.forEach((k) => {
      const state = Actors.jobState(k.type, k.m);
      const bounce = state < 0 ? Math.floor(now * 4) % 2 * 2 : 0;
      if (k.type === 'exchange') { // 손님 머리 위의 말풍선(동전 아이콘)
        const a = Actors.position(k.m);
        if (!a) return;
        const x = a.x, y = a.y - 76 - bounce;
        UI.button({ x: x - 22, y, w: 44, h: 28 }, '', { style: state < 0 ? 'secondary' : 'soft', onClick: () => order1(k),
          draw: (bx, by) => { UI.coin(bx + 6, by + 6, 2); UI.text(state < 0 ? '?' : state === 0 ? '…' : String(state), bx + 33, by + 14, 18, state < 0 ? C.alert : C.ink); } });
        UI.rect(x - 5, y + 30, 10, 4, C.ink); UI.rect(x - 2, y + 34, 4, 4, C.ink); // 말풍선 꼬리
        return;
      }
      const t = findThing(k.m != null ? 'm' + k.m : 'b' + Sim.info.placedBins(st)[0].uid);
      const r = ShopView.rectOf(g, t);
      const second = k.type === 'repair' && tasks.some((o) => o.m === k.m && o.type === 'refill');
      const x = r.x + r.w / 2, y = k.m != null ? r.y + 58 + (second ? 32 : 0) : r.y - 4; // 쓰레기통(청소)은 위에
      const text = k.noStock ? '재고 없음' : TASK[k.type];
      const wide = k.noStock || state >= 0;
      btn(x - (wide ? 42 : 30), y - 26 - bounce, wide ? 84 : 60, 28, state === 0 ? '처리 중' : state > 0 ? '대기 ' + state : text, () => order1(k), { style: state >= 0 || k.noStock ? 'soft' : k.type === 'repair' ? 'danger' : 'primary' });
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
    DATA.TASTES.forEach((t, i) => { // 아이콘 설명
      ShopView.tasteIcon(20 + i * 100, 552, t);
      label(t, 42 + i * 100, 560, C.sub);
    });
    label('S·M·L·XL = 크기', 530, 560, C.sub);
    const p = { x: 732, y: 74, w: 210, h: 478 };
    UI.panel(p, C.white, 3);
    label('할 일 ' + tasks.length, p.x + p.w / 2, p.y + 24, C.ink, 'center', 18);
    if (!tasks.length) label('지금은 한가해요', p.x + p.w / 2, p.y + 70, C.sub, 'center');
    label('바닥의 쓰레기는', p.x + p.w / 2, p.y + p.h - 44, C.sub, 'center');
    label('눌러서 치워요', p.x + p.w / 2, p.y + p.h - 20, C.sub, 'center');
    tasks.slice(0, 8).forEach((k, i) => {
      const m = k.type !== 'exchange' && k.m != null ? st.machines.find((x) => x.id === k.m) : null;
      const state = Actors.jobState(k.type, k.m);
      const head = state === 0 ? '처리 중' : state > 0 ? '대기 ' + state : k.noStock ? '재고 없음' : TASK[k.type];
      const tail = state >= 0 ? ' ' + TASK[k.type] : m ? ' · ' + mname(m) : k.type === 'exchange' ? ' · 손님' : '';
      btn(p.x + 12, p.y + 46 + i * 46, p.w - 24, 36, head + tail, () => order1(k), { style: state >= 0 || k.noStock ? 'soft' : k.type === 'repair' ? 'danger' : 'secondary' });
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
    const names = { sales: '장사', satisfaction: '손님 만족', decor: '가게 매력', soldOut: '품절', exchange: '환전 지연', dirty: '지저분함', claims: '항의', fade: '잊힘' };
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
    if (R.achieved.length) label('도전과제 ' + R.achieved.length + '개 달성: ' + R.achieved.map((a) => a.name).slice(0, 4).join(', '), 480, PANEL.y + 372 - 14, '#8a5a1a', 'center');
    if (st.bankrupt) {
      label('돈이 모두 떨어졌어요…', 480, PANEL.y + 388, C.alert, 'center', 22);
      btn(360, PANEL.y + PANEL.h - 58, 240, 44, '처음부터 다시', () => { State.data.sim = null; enter(); }, { style: 'danger', size: 18 });
    } else {
      btn(360, PANEL.y + PANEL.h - 58, 240, 44, '가게 정리하러 가기', () => { phase = 'build'; ShopView.autoPlace(st); }, { style: 'primary', size: 18 });
    }
  }

  // ---------- 개발자 모드(F2): 플레이 테스트용 ----------
  const DEV = { x: 8, y: 64, w: 244, h: 440 };
  const inDev = (p) => p.x >= DEV.x && p.x <= DEV.x + DEV.w && p.y >= DEV.y && p.y <= DEV.y + DEV.h;
  function toggleDev() { dev = !dev; Sound.sfx('click'); }
  function cheat(fn, text) { fn(); if (text) say(text); if (phase !== 'open') { achieve(Sim.checkAchievements(st)); ShopView.autoPlace(st); save(); } }
  function autoDays(n) {
    let done = 0;
    for (; done < n && Sim.canOpen(st).ok && !st.bankrupt; done++) { Sim.autoPrep(st); achieve(Sim.runDay(st).achieved); }
    say(done ? done + '일을 자동으로 진행했어요' : '기계와 쓰레기통을 먼저 설치해 주세요');
  }
  function devActions() {
    if (phase === 'open') {
      return [
        ['고장 내기', () => onEvents(day.debug('break'))], ['쓰레기', () => onEvents(day.debug('litter'))],
        ['환전 손님', () => onEvents(day.debug('exchange'))], ['기계 비우기', () => onEvents(day.debug('empty'))],
        [devAuto ? '자동 처리 끄기' : '자동 처리 켜기', () => { day.debug('auto'); devAuto = !devAuto; }], [speed === 8 ? '1배속' : '8배속', () => { speed = speed === 8 ? 1 : 8; paused = false; }],
        ['바로 마감', () => { if (!devAuto) day.debug('auto'); finishDay(); }], ['돈 +100만', () => { st.money += 1000000; }],
      ];
    }
    return [
      ['돈 +100만', () => cheat(() => { st.money += 1000000; })], ['돈 +1억', () => cheat(() => { st.money += 100000000; })],
      ['랭크 올리기', () => cheat(() => { if (st.rank < 5) { st.rank++; st.rankUpDay = st.day; } })], ['랭크 내리기', () => cheat(() => { if (st.rank > 1) st.rank--; })],
      ['인기도 +500', () => cheat(() => { st.popularity += 500; })], ['평판 100', () => cheat(() => { st.reputation = 100; })],
      ['인형 +10씩', () => cheat(() => DATA.DOLLS.filter((d) => d.rank <= st.rank).forEach((d) => Sim.addStock(st, d.id, 10, d.cost)), '창고에 인형을 넣었어요(용량 무시)')],
      ['인형 해금', () => cheat(() => DATA.DOLLS.forEach((d) => { if (d.locked) st.unlocked[d.id] = true; }), '보상 인형을 해금했어요')],
      ['1일 자동', () => cheat(() => autoDays(1))], ['7일 자동', () => cheat(() => autoDays(7))],
      ['튜토리얼 다시', () => cheat(() => { st.tutorial = 0; })], ['과제 초기화', () => { st.ach = {}; st.unlocked = {}; toasts = []; save(); say('도전과제를 초기화했어요'); }],
    ];
  }
  function drawDev() {
    if (!dev) return;
    UI.block(DEV);
    UI.panel(DEV, '#fff0f0', 3);
    label('개발자 모드 (F2)', DEV.x + DEV.w / 2, DEV.y + 20, C.alert, 'center', 18);
    devActions().forEach(([t, fn], i) => btn(DEV.x + 10 + (i % 2) * 116, DEV.y + 40 + Math.floor(i / 2) * 44, 108, 36, t, fn));
    const y = DEV.y + DEV.h - 70;
    label(st.day + '일차 · ' + Sim.rankNo(st) + '랭크 · ' + (phase === 'open' ? '영업 ' + day.time() + '분' : phase === 'build' ? '건축' : '정산'), DEV.x + 12, y);
    label('인기 ' + Math.round(st.popularity) + ' · 평판 ' + Math.round(st.reputation), DEV.x + 12, y + 22);
    label('평균 매출 ' + man(st.avgRev || 0), DEV.x + 12, y + 44);
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
      else if (popup === 'stock') drawStockPopup();
      else if (popup === 'plan') drawPlanPopup();
    }
    drawTutorial(now);
    drawDev();
    if (msg && now < msg.until) {
      const low = popup === 'order' || popup === 'stock';
      const m = low ? { x: 290, y: 520, w: 380, h: 28 } : { x: 250, y: 66, w: 460, h: 32 };
      UI.chip(m);
      label(msg.text, m.x + m.w / 2, m.y + m.h / 2, C.ink, 'center');
    }
    if (toast && now > toast.until) toast = null;
    if (!toast && toasts.length) { toast = { a: toasts.shift(), until: now + (toasts.length > 2 ? 1.2 : 2.5) }; Sound.sfx('fanfare'); }
    if (toast) {
      UI.panel({ x: 150, y: 8, w: 420, h: 42 }, '#fff6cf', 3); // 위쪽 정보 줄에 띄워 가게의 버튼을 가리지 않는다
      label('도전과제 달성! ' + toast.a.name, 360, 20, C.ink, 'center');
      label(rewardText(toast.a.reward), 360, 39, '#8a5a1a', 'center');
    }
    ctx.restore();
  }

  return { enter, leave, escape, draw, press, move, release, rewardText, rotate, toggleDev };
})();
