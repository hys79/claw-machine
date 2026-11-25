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
  let scope = 'one';      // 난이도·가격 적용 범위
  let tab = 'machine';    // 상점 탭
  let page = 0;
  let cart = {};
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
    if (!d.sim || d.sim.v !== 2) {
      d.sim = Sim.newGame(d.playerName, d.shopName);
      Sim.autoPrep(d.sim, { order: false }); // 가진 인형만으로 첫 진열(발주 없음)
    }
    st = Sim.upgradeState(d.sim);
    ShopView.autoPlace(st);
    toasts = []; toast = null;
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
    if (phase === 'open') { // 바닥의 쓰레기를 누르면 주우러 간다
      const id = Actors.litterAt(p);
      if (id != null && Actors.enqueue({ type: 'litter', litter: id })) Sound.sfx('click');
      return;
    }
    if (phase !== 'build' || popup) return;
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
    if (!drag) return;
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
    topBar();
    label('기계 칸 ' + Sim.info.footUsed(st) + ' / ' + CFG.SIM.SHOP[st.shopLevel].slots, 560, 18);
    label('창고 ' + Sim.info.stockTotal(st) + ' / ' + CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, 560, 41);
    label('유행 ' + st.trend.taste + ' → 다음 ' + st.trend.next, 700, 18, '#8a4fc0');
    label('예상 손님 ' + Sim.forecast(st) + '명', 700, 41, C.sub);
    sidePanel();
    const bar = (x, w, text, onClick, o) => btn(x, 514, w, 46, text, onClick, Object.assign({ size: 18 }, o));
    bar(20, 106, '상점', () => { popup = 'shop'; page = 0; });
    bar(138, 106, '발주', () => { popup = 'order'; page = 0; cart = {}; });
    bar(256, 106, shortage().length ? '창고 !' : '창고', () => { popup = 'stock'; page = 0; }, shortage().length ? { style: 'danger' } : {});
    bar(374, 120, '추천 진열', () => { Sim.autoPrep(st, { order: false }); say('가진 인형으로 다시 진열했어요'); achieve(Sim.checkAchievements(st)); save(); });
    if (st.staff) bar(506, 120, '건너뛰기', skip, { style: Sim.canSkip(st).ok ? 'secondary' : 'soft' });
    bar(742, 198, '영업 시작', openShop, { style: 'primary', size: 22 });
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
    if (t && t.kind === 'fix') {
      const key = t.ref, up = key === 'exchange' ? 'exchanger' : key === 'trash' ? 'bin' : null;
      const have = up ? !!st.equip[up] : true;
      label(up && have ? DATA.EQUIPMENT[up].name : ShopView.FIX_NAME[key], mid, p.y + 30, C.ink, 'center', 18);
      const desc = key === 'exchange' ? ['손님이 환전하는 곳'] : key === 'trash' ? ['손님 쓰레기를 모아요'] : ['청소를 대신 해 줘요'];
      desc.concat(['', '끌어서 옮길 수 있어요']).forEach((s, i) => label(s, mid, p.y + 70 + i * 24, C.sub, 'center'));
      if (up && !have) {
        const e = DATA.EQUIPMENT[up], locked = e.rank > st.rank;
        label(e.name, mid, p.y + 190, C.ink, 'center');
        UI.wrap(e.desc, p.w - 24, 14).forEach((s, i) => label(s, mid, p.y + 216 + i * 22, C.sub, 'center'));
        btn(p.x + 12, p.y + 280, p.w - 24, 40, locked ? (6 - e.rank) + '랭크부터' : '바꾸기 ' + man(e.price), () => done(Sim.buyEquipment(st, up), e.name + ' 설치!'), { style: 'primary', disabled: locked });
      }
      return;
    }
    if (t && t.kind === 'decor') {
      const d = t.def;
      UI.wrap(d.name, p.w - 20, 18).forEach((s, i) => label(s, mid, p.y + 30 + i * 24, C.ink, 'center', 18));
      label((d.wall ? '벽 소품' : '바닥 소품') + ' · 매력 ' + d.charm, mid, p.y + 90, C.sub, 'center');
      label('가게 매력 ' + Sim.charmRaw(st).toFixed(1) + ' / ' + Sim.charmCap(st), mid, p.y + 118, C.blue, 'center');
      label(d.locked ? '도전과제 기념품' : '같은 소품은 효과가 줄어요', mid, p.y + 146, C.sub, 'center');
      if (!d.locked) btn(p.x + 12, p.y + p.h - 50, p.w - 24, 36, '팔기 +' + man(d.price * CFG.SIM.DECOR.SELL), () => { done(Sim.sellDecor(st, t.ref.uid), '소품을 팔았어요'); sel = null; });
      return;
    }
    if (!m) {
      label('가게 꾸미기', p.x + p.w / 2, p.y + 30, C.ink, 'center', 18);
      ['끌어서 옮기고', '눌러서 설정해요.', '', '주문한 인형은', '다음 영업 아침', '창고에 들어와요.'].forEach((s, i) => label(s, mid, p.y + 70 + i * 24, C.sub, 'center'));
      label('가게 매력 ' + Sim.charmRaw(st).toFixed(1) + ' / ' + Sim.charmCap(st), mid, p.y + 240, C.blue, 'center');
      const stored = ShopView.things(st).filter((x) => !x.holder.pos).length;
      if (stored) label('자리 없는 소품 ' + stored + '개', mid, p.y + 268, C.alert, 'center');
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
    popupFrame('상점', 600); // 왼쪽의 탭 버튼과 겹치지 않게
    [['machine', '기계'], ['equip', '설비'], ['decor', '소품'], ['grow', '확장·직원']].forEach(([k, t], i) => btn(PANEL.x + 20 + i * 104, PANEL.y + 12, 96, 34, t, () => { tab = k; page = 0; }, { style: tab === k ? 'primary' : 'secondary' }));
    const rows = [];
    const rankLock = (r) => (r > st.rank ? (6 - r) + '랭크부터' : null);
    if (tab === 'machine') {
      Object.keys(DATA.MACHINES).forEach((k) => {
        const d = DATA.MACHINES[k];
        rows.push({ name: d.name, desc: '칸 ' + d.footprint + ' · 넣는 크기 ' + d.sizes.join(' ') + ' · 하루 전기 ' + man(d.power), price: d.price, lock: rankLock(d.rank),
          buy: () => { if (!ShopView.hasRoom(st, { kind: 'machine', w: d.footprint })) { say('놓을 바닥이 없어요. 소품을 옮겨 주세요'); Sound.sfx('buzz'); return; } done(Sim.buyMachine(st, k), '새 기계를 들였어요. 진열을 해 주세요'); } });
      });
    } else if (tab === 'decor') {
      DATA.DECOR.filter((d) => !d.locked).forEach((d) => {
        const owned = st.decors.filter((o) => o.id === d.id).length;
        rows.push({ name: d.name + (owned ? ' (' + owned + '개)' : ''), desc: (d.wall ? '벽' : '바닥 ' + d.width + '칸') + ' · 매력 ' + d.charm, price: d.price,
          lock: d.champion && !st.champion ? '1위 달성 후' : rankLock(d.rank),
          buy: () => { if (!ShopView.hasRoom(st, { kind: 'decor', w: d.width, wall: !!d.wall })) { say('놓을 자리가 없어요'); Sound.sfx('buzz'); return; } done(Sim.buyDecor(st, d.id), d.name + ' 설치!'); } });
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
  function drawStockPopup() {
    const cap = CFG.SIM.WAREHOUSE[st.warehouseLevel].cap, next = CFG.SIM.WAREHOUSE[st.warehouseLevel + 1];
    popupFrame('창고  ' + Sim.info.stockTotal(st) + ' / ' + cap);
    const short = shortage();
    const ids = DATA.DOLLS.map((d) => d.id).filter((id) => stockQty(id) || comingQty(id) || short.indexOf(id) >= 0)
      .sort((a, b) => (short.indexOf(b) >= 0) - (short.indexOf(a) >= 0));
    const per = 7;
    pager(ids.length, per);
    ['창고', '진열 중', '입고 예정', '지난 영업'].forEach((s, i) => label(s, PANEL.x + 300 + i * 80, PANEL.y + 70, C.sub, 'right'));
    label('처분(원가의 ' + Math.round(CFG.SIM.STOCK_SELL * 100) + '%)', PANEL.x + 650, PANEL.y + 70, C.sub, 'center');
    if (!ids.length) label('창고가 비었어요. 발주해 주세요.', 480, 290, C.sub, 'center', 18);
    ids.slice(page * per, page * per + per).forEach((id, i) => {
      const d = Sim.info.doll(id), y = PANEL.y + 86 + i * 44, low = short.indexOf(id) >= 0;
      ShopView.dollIcon(PANEL.x + 26, y + 8, d, 3);
      label(d.name, PANEL.x + 56, y + 10);
      label(low ? '모자랄 수 있어요!' : d.size + ' · ' + d.taste.join(', '), PANEL.x + 56, y + 30, low ? C.alert : C.sub);
      [stockQty(id), loadedTotal(id), comingQty(id), st.used[id] || 0].forEach((v, k) => label(String(v), PANEL.x + 300 + k * 80, y + 20, k === 0 && low ? C.alert : C.ink, 'right'));
      const sell = (n) => { const r = Sim.sellStock(st, id, n); done(r, r.ok ? r.qty + '개 처분 +' + won(r.gain) : ''); };
      const none = !stockQty(id);
      btn(PANEL.x + 575, y + 4, 44, 32, '1', () => sell(1), { disabled: none });
      btn(PANEL.x + 627, y + 4, 44, 32, '10', () => sell(10), { disabled: none });
      btn(PANEL.x + 679, y + 4, 60, 32, '전부', () => sell(stockQty(id)), { disabled: none });
    });
    if (next) btn(PANEL.x + 500, PANEL.y + PANEL.h - 50, 240, 36, '확장 ' + next.cap + '개 · ' + man(next.cost), () => done(Sim.expandWarehouse(st), '창고를 넓혔어요'), { style: 'primary' });
    btn(PANEL.x + 360, PANEL.y + PANEL.h - 50, 128, 36, '발주하기', () => { popup = 'order'; page = 0; cart = {}; });
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
    pops = pops.filter((p) => now - p.t < 1.1);
    pops.forEach((p) => UI.text(p.text, p.x, p.y - (now - p.t) * 24, 14, p.color, 'center', C.white, 4));
    // 할 일 말풍선(누르면 처리)
    tasks.forEach((k) => {
      let x, y;
      const t = findThing(k.m != null ? 'm' + k.m : k.type === 'exchange' ? 'fexchange' : 'ftrash');
      const r = ShopView.rectOf(g, t);
      x = r.x + r.w / 2; y = r.y - 4 - (k.type === 'repair' && tasks.some((o) => o.m === k.m && o.type === 'refill') ? 34 : 0);
      const bounce = Math.floor(now * 4) % 2 * 2;
      const text = k.noStock ? '재고 없음' : TASK[k.type] + (k.type === 'exchange' ? ' ' + k.waiting : '');
      const state = Actors.jobState(k.type, k.m);
      const wide = k.noStock || state >= 0;
      btn(x - (wide ? 42 : 30), y - 26 - (state < 0 ? bounce : 0), wide ? 84 : 60, 28, state === 0 ? '처리 중' : state > 0 ? '대기 ' + state : text, () => order1(k), { style: state >= 0 || k.noStock ? 'soft' : k.type === 'repair' ? 'danger' : 'primary' });
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
    label('바닥의 쓰레기는', p.x + p.w / 2, p.y + p.h - 44, C.sub, 'center');
    label('눌러서 치워요', p.x + p.w / 2, p.y + p.h - 20, C.sub, 'center');
    tasks.slice(0, 8).forEach((k, i) => {
      const m = k.m != null ? st.machines.find((x) => x.id === k.m) : null;
      const state = Actors.jobState(k.type, k.m);
      const head = state === 0 ? '처리 중' : state > 0 ? '대기 ' + state : k.noStock ? '재고 없음' : TASK[k.type];
      const tail = state >= 0 ? ' ' + TASK[k.type] : m ? ' · ' + mname(m) : k.type === 'exchange' ? ' · ' + k.waiting + '명' : '';
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
    if (msg && now < msg.until) {
      UI.chip({ x: 250, y: 66, w: 460, h: 32 });
      label(msg.text, 480, 82, C.ink, 'center');
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

  return { enter, leave, escape, draw, press, move, release, rewardText };
})();
