// 시뮬레이션 코어 검증 도구: 화면 없이 며칠을 돌려 수치가 말이 되는지 확인한다.
//   node tools/simrun.js [일수=30] [시드=1] [옵션]
//   옵션: --daily(매일 한 줄) --detail(마지막 날 기계·손님별 상세) --nobuy(기계/확장 자동 구매 끄기) --idle(고장 방치)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
const ctx = vm.createContext({ console, Math, Date, JSON });
['config.js', 'data.js', 'sim.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
const Sim = vm.runInContext('Sim', ctx);
const CFG = vm.runInContext('CFG', ctx);
const DATA = vm.runInContext('DATA', ctx);

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const nums = args.filter((a) => !a.startsWith('--')).map(Number);
const DAYS = nums[0] || 30, SEED = nums[1] || 1;
const has = (f) => flags.indexOf(f) >= 0;
const won = (n) => Math.round(n).toLocaleString('ko-KR');
const pad = (s, n) => String(s).padStart(n, ' ');

const st = Sim.newGame('테스트', '테스트가게', SEED);
const rows = [];
let last = null;

// 자동 운영 규칙(검증용): 돈이 모이면 기계를 늘리고, 점포·창고를 확장한다.
function autoGrow() {
  if (has('--nobuy')) return;
  const f = (t) => DATA.MACHINES[t];
  const room = () => st.machines.reduce((n, m) => n + f(m.type).footprint, 0);
  const want = ['standard', 'mini', 'timer', 'big', 'standard', 'timer', 'big', 'standard', 'mini', 'big'];
  const have = st.machines.length;
  if (have < want.length) {
    const t = want[have];
    if (st.money > f(t).price + 900000 && room() + f(t).footprint <= CFG.SIM.SHOP[st.shopLevel].slots) { Sim.buyMachine(st, t); return; }
  }
  const nextShop = CFG.SIM.SHOP[st.shopLevel + 1];
  if (nextShop && st.rank >= st.shopLevel + 2 && st.money > nextShop.cost + 1500000 && room() >= CFG.SIM.SHOP[st.shopLevel].slots) Sim.expandShop(st);
  const nextWh = CFG.SIM.WAREHOUSE[st.warehouseLevel + 1];
  if (nextWh && st.money > nextWh.cost + 1500000 && Sim.info.stockTotal(st) > CFG.SIM.WAREHOUSE[st.warehouseLevel].cap * 0.7) Sim.expandWarehouse(st);
}

for (let i = 0; i < DAYS; i++) {
  autoGrow();
  Sim.autoPrep(st);
  last = Sim.runDay(st, { respond: !has('--idle') });
  rows.push(last);
  if (has('--daily')) {
    console.log(
      pad(last.day, 3) + '일 ' + pad(last.weather, 6) + (last.show ? ' ★공연' : '      ') +
      ' 방문' + pad(last.visitors, 4) + ' 판' + pad(last.plays, 4) + ' 획득' + pad(last.wins, 3) +
      ' 매출' + pad(won(last.revenue), 9) + ' 원가' + pad(won(last.payout), 8) + ' 손익' + pad(won(last.profit), 9) +
      ' 소지금' + pad(won(st.money), 11) + ' 평판' + pad(Math.round(st.reputation), 3) + ' 인기' + pad(st.popularity.toFixed(1), 6) +
      ' ' + Sim.rankNo(st) + '랭크 기계' + st.machines.length + ' 일매출평균' + won(st.avgRev));
  }
  if (st.bankrupt) { console.log('폐업(돈이 바닥남) - ' + last.day + '일차'); break; }
}

const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
const n = rows.length;
console.log('\n=== ' + n + '일 요약 (시드 ' + SEED + ') ===');
console.log('하루 평균: 방문 ' + Math.round(sum('visitors') / n) + '명, 판 ' + Math.round(sum('plays') / n) + ', 매출 ' + won(sum('revenue') / n) + '원, 인형 원가 ' + won(sum('payout') / n) + '원, 손익 ' + won(sum('profit') / n) + '원');
console.log('환수율(원가/매출): ' + (sum('payout') / sum('revenue') * 100).toFixed(1) + '%   방문당 판: ' + (sum('plays') / sum('visitors')).toFixed(2) + '   손님 평균 만족도: ' + (rows.reduce((s, r) => s + r.avgSat, 0) / n).toFixed(2));
console.log('이탈: 마음에 드는 인형 없음 ' + sum0('nothing') + ' / 예산 ' + sum0('budget') + ' / 줄 기다리다 ' + sum0('queue') + ' / 품절 ' + sum0('empty') + '  (방문 대비 ' + ((sum0('nothing') + sum0('budget') + sum0('queue') + sum0('empty')) / sum('visitors') * 100).toFixed(0) + '%)');
function sum0(k) { return rows.reduce((s, r) => s + r.balk[k], 0); }
console.log('최종: ' + st.day + '일차 소지금 ' + won(st.money) + '원, ' + Sim.rankName(st) + ', 평판 ' + Math.round(st.reputation) + ', 인기도 ' + st.popularity.toFixed(1) +
  ', 점포 ' + CFG.SIM.SHOP[st.shopLevel].name + ', 창고 ' + CFG.SIM.WAREHOUSE[st.warehouseLevel].cap + '개, 기계 ' + st.machines.map((m) => DATA.MACHINES[m.type].name.replace(' 뽑기 기계', '')).join('/'));
if (has('--detail') && last) {
  console.log('\n[마지막 날 기계별]');
  last.byMachine.forEach((m) => console.log('  #' + m.id + ' ' + DATA.MACHINES[m.type].name + ' 판 ' + m.plays + ' 획득 ' + m.wins + ' 매출 ' + won(m.revenue) + ' 원가 ' + won(m.payout) + ' (환수 ' + (m.revenue ? (m.payout / m.revenue * 100).toFixed(0) : 0) + '%) 고장 ' + m.downMin + '분 품절 ' + m.emptyMin + '분'));
  console.log('[마지막 날 손님 유형별]');
  Object.keys(last.byType).forEach((k) => { const t = last.byType[k]; console.log('  ' + k + ' 방문 ' + t.visitors + ' 판 ' + t.plays + ' 매출 ' + won(t.revenue)); });
  console.log('[시간대별 매출] ' + last.hourly.map((v, i) => (CFG.SIM.OPEN + i) + '시:' + Math.round(v / 1000) + 'k').join(' '));
}
const lb = Sim.leaderboard(st, 5);
if (lb.detail) {
  console.log('\n[전국 순위] 내 가게 ' + lb.position + '위 / ' + lb.total + '곳 (인기도 ' + st.popularity.toFixed(0) + ')');
  lb.entries.forEach((e) => console.log('  ' + pad(e.pos, 3) + '위 ' + (e.me ? '★ ' : '  ') + e.name + '  ' + e.score.toFixed(0)));
} else {
  console.log('\n(전국 순위는 1랭크가 되면 표시됩니다. 현재 인기도 ' + st.popularity.toFixed(0) + ')');
}
