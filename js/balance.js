// 자동 생성 파일: balance/balance.xlsx → python tools/balance.py apply. 직접 고치지 않는다.
// 기본값(config.js, data.js)과 다른 항목만 덮어쓴다. "#id" 는 목록에서 id 로 찾는다.
[
].forEach(([path, value]) => {
  let o = path[0] === 'CFG' ? CFG : DATA;
  for (let i = 1; i < path.length; i++) {
    let k = path[i];
    if (typeof k === 'string' && k[0] === '#') k = o.findIndex((x) => x.id === k.slice(1));
    if (i === path.length - 1) o[k] = value;
    else o = o[k] || (o[k] = {});
  }
});
