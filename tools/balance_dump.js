// 밸런스 도구용: config.js / data.js 의 기본값(옵션 --effective 면 balance.js 적용 후 값)을 JSON으로 출력한다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', 'js');
const ctx = vm.createContext({ console, Math, Date, JSON });
const files = ['config.js', 'data.js'];
if (process.argv.includes('--effective') && fs.existsSync(path.join(root, 'balance.js'))) files.push('balance.js');
files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
process.stdout.write(vm.runInContext(`JSON.stringify({
  CFG: { START_MONEY: CFG.START_MONEY, SIM: CFG.SIM },
  DATA: { DOLLS: DATA.DOLLS, MACHINES: DATA.MACHINES, CUSTOMERS: DATA.CUSTOMERS, EQUIPMENT: DATA.EQUIPMENT, TASTES: DATA.TASTES, DECOR: DATA.DECOR, ACHIEVEMENTS: DATA.ACHIEVEMENTS },
})`, ctx));
