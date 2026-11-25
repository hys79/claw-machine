// 시뮬레이션 코어 검증 도구: 화면 없이 며칠을 돌려 수치가 말이 되는지 확인한다.
//   node tools/simrun.js [일수=30] [시드=1] [옵션]
//   옵션: --daily(매일 한 줄) --detail(마지막 날 상세) --nobuy(구매 끄기) --idle(영업 중 일 방치)
//         --staff(직원이 생기면 건너뛸 수 있는 날은 건너뛰기) --seeds(시드 1~8의 랭크 도달일 요약)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const ctx = vm.createContext({ console, Math, Date, JSON });
['config.js', 'data.js', 'balance.js', 'sim.js'].filter((f) => fs.existsSync(path.join(root, f))).forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
const Sim = vm.runInContext('Sim', ctx);
const CFG = vm.runInContext('CFG', ctx);
const DATA = vm.runInContext('DATA', ctx);

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const nums = args.filter((a) => !a.startsWith('--')).map(Number);
const has = (f) => flags.indexOf(f) >= 0;
const DAYS = nums[0] || (has('--seeds') ? 220 : 30), SEED = nums[1] || 1;
const won = (n) => Math.round(n).toLocaleString('ko-KR');
const pad = (s, n) => String(s).padStart(n, ' ');

// 자동 운영 규칙(검증용): 단계별 성장안 순서대로, 여유 자금이 남으면 산다.
const PLAN = [
  ['equip', 'bin'], ['machine', 'standard'],
  ['shop', 1], ['equip', 'exchanger'], ['machine', 'standard'],
  ['machine', 'timer'], ['equip', 'globalpay'], ['staff'],
  ['shop', 2], ['machine', 'big'], ['machine', 'standard'], ['equip', 'robot'], ['mod', 'durable'], ['mod', 'capacity'],
  ['shop', 3], ['machine', 'big'], ['machine', 'timer'], ['machine', 'standard'], ['machine', 'big'], ['mod', 'durable'], ['mod', 'capacity'],
];
function autoGrow(st, done) {
  if (has('--nobuy')) return;
  // 하루에 뽑혀 나가는 인형이 창고 용량에 가까워지면 창고를 넓힌다
  const wins = st.lastWins || 0;
  if (wins > CFG.SIM.WAREHOUSE[st.warehouseLevel].cap * 0.6) Sim.expandWarehouse(st);
  const keep = 300000 + st.machines.length * 120000; // 발주할 돈은 남긴다
  for (let i = 0; i < PLAN.length; i++) {
    if (done[i]) continue;
    const [kind, v] = PLAN[i];
    let cost = 0, run = null;
    if (kind === 'equip') { cost = DATA.EQUIPMENT[v].price; run = () => Sim.buyEquipment(st, v); }
    else if (kind === 'machine') { cost = DATA.MACHINES[v].price; run = () => Sim.buyMachine(st, v); }
    else if (kind === 'shop') { cost = CFG.SIM.SHOP[v].cost; run = () => Sim.expandShop(st); }
    else if (kind === 'staff') { run = () => Sim.hireStaff(st); }
    else {
      cost = DATA.EQUIPMENT[v].price;
      run = () => { const m = st.machines.find((x) => !x.mods[v] && !(v === 'capacity' && x.type === 'timer')); return m ? Sim.buyEquipment(st, v, m.id) : { ok: false }; };
    }
    if (st.money < cost + keep) return;             // 순서대로: 돈이 모일 때까지 기다린다
    if (run().ok) { done[i] = st.day; return; }     // 하루에 한 가지
  }
}

function simulate(seed, days, onDay) {
  const st = Sim.newGame('테스트', '테스트가게', seed);
  const rows = [], done = {}, reach = {};
  let skipped = 0;
  for (let i = 0; i < days; i++) {
    autoGrow(st, done);
    Sim.autoPrep(st);
    let r = null;
    if (has('--staff')) { const s = Sim.skipDay(st); if (s.ok) { r = s.result; skipped++; } }
    if (!r) r = Sim.runDay(st, { mode: has('--idle') ? 'none' : 'bot' });
    rows.push(r);
    st.lastWins = r.wins;
    if (r.rankUp && !reach[r.rankUp]) reach[r.rankUp] = r.day;
    if (r.champion) reach.champion = r.day;
    if (onDay) onDay(st, r);
    if (st.bankrupt) break;
  }
  return { st, rows, reach, skipped };
}
const reachText = (reach) => [2, 3, 4, 5].map((k) => (6 - k) + '랭크 ' + (reach[k] || '-') + '일').join(' / ') + ' / 전국 1위 ' + (reach.champion || '-') + '일';

if (has('--seeds')) {
  for (let s = 1; s <= 8; s++) {
    const { st, reach, rows } = simulate(s, DAYS);
    const last = rows.slice(-10).reduce((n, r) => n + r.profit, 0) / 10;
    console.log('시드 ' + s + ': ' + reachText(reach) + ' | 소지금 ' + won(st.money) + ' | 마지막 10일 손익 ' + won(last) + (st.bankrupt ? ' | 폐업' : ''));
  }
  process.exit(0);
}

const { st, rows, reach, skipped } = simulate(SEED, DAYS, (st, r) => {
  if (!has('--daily')) return;
  const tk = r.tasks;
  console.log(
    pad(r.day, 3) + '일' + (r.special ? ' ◆' : r.show ? ' ★' : '  ') +
    ' 방문' + pad(r.visitors, 4) + ' 판' + pad(r.plays, 4) + ' 획득' + pad(r.wins, 3) +
    ' 매출' + pad(won(r.revenue), 10) + ' 손익' + pad(won(r.profit), 10) + ' 소지금' + pad(won(st.money), 11) +
    ' 평판' + pad(Math.round(r.rep), 3) + ' 인기' + pad(Math.round(r.popularity), 5) + ' ' + Sim.rankNo(st) + '랭크 기계' + st.machines.length +
    ' 일[보충' + tk.refill + ' 청소' + tk.clean + ' 환전' + tk.exchange + ' 수리' + tk.repair + ']');
});

const n = rows.length;
const sum = (f, list) => (list || rows).reduce((s, r) => s + f(r), 0);
console.log('\n=== ' + n + '일 요약 (시드 ' + SEED + ') ===' + (skipped ? ' 건너뛴 날 ' + skipped : ''));
console.log('도달: ' + reachText(reach));
console.log('구간별 하루 평균 (방문 / 매출 / 손익 / 환수율 / 일[보충·청소·환전·수리])');
[[1, 7], [8, 20], [21, 45], [46, 90], [91, 150], [151, 999]].forEach(([a, b]) => {
  const l = rows.filter((r) => r.day >= a && r.day <= b);
  if (!l.length) return;
  const avg = (f) => sum(f, l) / l.length;
  console.log('  ' + pad(a, 3) + '~' + pad(l[l.length - 1].day, 3) + '일: ' + pad(Math.round(avg((r) => r.visitors)), 4) + '명 / ' + pad(won(avg((r) => r.revenue)), 10) + ' / ' + pad(won(avg((r) => r.profit)), 10) +
    ' / ' + (sum((r) => r.payout, l) / Math.max(1, sum((r) => r.revenue, l)) * 100).toFixed(0) + '% / ' +
    ['refill', 'clean', 'exchange', 'repair'].map((k) => avg((r) => r.tasks[k]).toFixed(1)).join('·'));
});
const balk = (k) => sum((r) => r.balk[k]);
console.log('이탈: 취향·인형 ' + balk('nothing') + ' / 예산 ' + balk('budget') + ' / 줄 ' + balk('queue') + ' / 품절 ' + balk('empty') + ' / 환전 ' + balk('exchange') + ' (방문의 ' + ((balk('nothing') + balk('budget') + balk('queue') + balk('empty') + balk('exchange')) / sum((r) => r.visitors) * 100).toFixed(0) + '%)');
console.log('만족도 평균 ' + (sum((r) => r.avgSat) / n).toFixed(2) + '   원했지만 없던 취향: ' + DATA.TASTES.map((t) => t + ' ' + sum((r) => r.missed[t])).join(', '));
console.log('최종: ' + st.day + '일차 소지금 ' + won(st.money) + '원, ' + Sim.rankName(st) + ', 평판 ' + Math.round(st.reputation) + ', 인기도 ' + Math.round(st.popularity) +
  ', 점포 ' + CFG.SIM.SHOP[st.shopLevel].name + ', 직원 ' + (st.staff ? '있음' : '없음') + ', 설비 ' + (Object.keys(st.equip).join(',') || '-') +
  ', 기계 ' + st.machines.map((m) => DATA.MACHINES[m.type].name.replace(' 뽑기 기계', '')).join('/') + (st.bankrupt ? '  ** 폐업 **' : ''));
if (has('--detail')) {
  const last = rows[n - 1];
  console.log('\n[마지막 날 기계별]');
  last.byMachine.forEach((m) => console.log('  #' + m.id + ' ' + DATA.MACHINES[m.type].name + ' 판 ' + m.plays + ' 획득 ' + m.wins + ' 매출 ' + won(m.revenue) + ' 원가 ' + won(m.payout) + ' (환수 ' + (m.revenue ? (m.payout / m.revenue * 100).toFixed(0) : 0) + '%) 고장 ' + m.downMin + '분 품절 ' + m.emptyMin + '분'));
  console.log('[마지막 날 손님 분류별]');
  Object.keys(last.byType).forEach((k) => { const t = last.byType[k]; console.log('  ' + k + ' 방문 ' + t.visitors + ' 판 ' + t.plays + ' 매출 ' + won(t.revenue)); });
  console.log('[마지막 날 인기도 원인] ' + Object.keys(last.popReasons).map((k) => k + ' ' + last.popReasons[k].toFixed(1)).join(', '));
}
const lb = Sim.leaderboard(st, 5);
if (lb.detail) {
  console.log('\n[전국 순위] 내 가게 ' + lb.position + '위 / ' + lb.total + '곳 (인기도 ' + Math.round(st.popularity) + ')');
  lb.entries.forEach((e) => console.log('  ' + pad(e.pos, 3) + '위 ' + (e.me ? '★ ' : '  ') + e.name + '  ' + e.score.toFixed(0)));
}
