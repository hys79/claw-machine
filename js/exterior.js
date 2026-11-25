// 하루의 시작과 끝에 보여 주는 가게 바깥 모습. 프롤로그의 '우리 가게가 있는 거리'(js/cutscene.js) 그림을 그대로 쓰고
// 계절·날씨·밤낮·행사만 덧입힌다. 계산 없이 그리기만 한다. 좌표는 컷신과 같은 도트 좌표(가운데 0~240, 높이 144).
const Exterior = (function () {
  const DUR = 3.0; // 보여 주는 시간(초). 화면을 누르면 바로 넘어간다
  const WEATHER_NAME = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈', heat: '폭염' };
  let layer = null, g = null, bg = null, bgKey = '';

  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const hash = (i, n) => { const v = Math.sin(i * 127.1) * 43758.5453; return (v - Math.floor(v)) * n; }; // 늘 같은 자리에 흩뿌리기
  const mix = (a, b, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y))); R(cx - w, cy + y, w * 2 + 1, 1, c); } };

  // 계절·날씨·밤낮에 맞춘 거리 배경의 색(없는 항목은 프롤로그의 기본 모습)
  function theme(info, night) {
    const o = { night };
    let sky = { spring: ['#86caf2', '#f6eaf2'], summer: ['#6fbdf0', '#dcefff'], autumn: ['#7fb8e6', '#fbead0'], winter: ['#93b6d8', '#e6eef7'] }[info.season];
    if (info.weather === 'cloudy' || info.weather === 'snow') sky = [mix(sky[0], '#9aa8b6', 0.65), mix(sky[1], '#d5dbe2', 0.65)];
    if (info.weather === 'rain') sky = [mix(sky[0], '#5f7488', 0.75), mix(sky[1], '#aab8c4', 0.7)];
    if (info.weather === 'heat') sky = [mix(sky[0], '#ffb35c', 0.35), mix(sky[1], '#ffe2a8', 0.6)];
    if (night) sky = [mix(sky[0], '#101a4a', 0.82), mix(sky[1], '#7a5a9a', 0.7)];
    o.sky = sky;
    const leaf = { spring: ['#c9618a', '#f08fb4', '#ffc4d8'], autumn: ['#9a3f22', '#d96a2b', '#f2b33a'] }[info.season] || ['#2d7a47', '#3f9a55', '#6cc070'];
    o.leaf = night ? leaf.map((c) => mix(c, '#121a46', 0.42)) : leaf; // 나무는 밤의 덮개 위에 그려지므로 색을 직접 어둡게
    o.bare = info.season === 'winter';
    o.snow = info.weather === 'snow';
    if (info.weather === 'rain') { o.cloud = '#8d9dac'; o.cloudShade = '#76889a'; }
    if (info.weather === 'rain') { o.walk = '#ccd6df'; o.road = '#667482'; }
    if (night) { o.cloud = '#6a6f9a'; o.cloudShade = '#555a84'; }
    o.overcast = info.weather === 'cloudy' || info.weather === 'rain' || info.weather === 'snow';
    return o;
  }

  function sky(info, night, t) {
    const clear = info.weather === 'sunny' || info.weather === 'heat';
    if (night) {
      if (info.weather !== 'rain' && info.weather !== 'snow') for (let i = 0; i < 50; i++) if ((Math.floor(t * 3) + i) % 7) R(hash(i + 3, 320) - 40, hash(i * 7 + 1, 22) + 1, 1, 1, '#ffffff');
      if (info.weather === 'sunny' || info.weather === 'heat') {
        if (info.id === 'chuseok') { disc(205, 13, 11, '#fff3c2'); [[-4, -3, 2], [3, 2, 3], [-2, 5, 1]].forEach(([x, y, r]) => disc(205 + x, 13 + y, r, '#f0dd9a')); } // 추석의 보름달
        else { disc(205, 12, 7, '#fff3c2'); disc(202, 10, 6, theme(info, true).sky[0]); }
      }
    } else if (clear) {
      const y = 22 - 10 * Math.min(1, t / DUR), r = info.weather === 'heat' ? 9 : 7;
      disc(205, y, r + 3, 'rgba(255,240,170,0.5)'); disc(205, y, r, info.weather === 'heat' ? '#ff9d3a' : '#ffe066');
    }
    if (night && (info.show || info.special)) for (let i = 0; i < 3; i++) { // 공연일 밤: 아레나에서 올라오는 조명
      const sway = Math.sin(t * 2 + i * 2) * 14;
      for (let j = 0; j < 24; j++) R(178 + i * 18 + sway * j / 24 - j / 8, 50 - j * 2, 2 + j / 4, 2, ['rgba(255,120,200,0.2)', 'rgba(130,200,255,0.2)', 'rgba(255,230,120,0.2)'][i]);
    }
  }

  // 날짜 행사 장식(가게는 x 60~180, 지붕 y 26, 바닥 y 98)
  function decorations(info, t) {
    const id = info.id;
    if (!id) return;
    const bulbs = (cols) => { for (let i = 0; i < 20; i++) R(61 + i * 6, 62 + (i % 2) * 2, 2, 2, cols[(i + Math.floor(t * 3)) % cols.length]); };
    if (id === 'christmas') {
      bulbs(['#ff5a5a', '#ffd84a', '#5ad27a']);
      for (let i = 0; i < 4; i++) { const w = 4 + i * 3; R(24 - w - 1, 74 + i * 7, w * 2 + 3, 8, CFG.COLOR.ink); R(24 - w, 75 + i * 7, w * 2 + 1, 6, '#2f8a4a'); R(24 - w + 1 + ((i * 7 + Math.floor(t * 4) * 5) % (w * 2 - 2)), 77 + i * 7, 2, 2, i % 2 ? '#ff5a5a' : '#ffd84a'); }
      R(22, 103, 5, 6, '#7a5230'); R(22, 70, 5, 5, '#ffd84a');
    } else if (id === 'halloween') {
      bulbs(['#ff8a2a', '#8a4fc0']);
      [[44, 6], [191, 5], [22, 5]].forEach(([x, r]) => { disc(x, 104 - r + 2, r + 1, CFG.COLOR.ink); disc(x, 104 - r + 2, r, '#ff8a2a'); R(x - 1, 104 - r * 2 - 1, 2, 3, '#3f6b2a'); R(x - 3, 104 - r, 2, 2, '#3a2200'); R(x + 2, 104 - r, 2, 2, '#3a2200'); R(x - 2, 104 - r + 4, 5, 1, '#3a2200'); });
    } else if (id === 'chuseok' || id === 'seollal' || id === 'newyear' || id === 'nightmarket') {
      for (let i = 0; i < 7; i++) { const x = 64 + i * 18; R(x + 2, 61, 1, 3, CFG.COLOR.ink); R(x - 1, 63, 7, 9, CFG.COLOR.ink); R(x, 64, 5, 7, i % 2 ? '#3f6fd8' : '#e0453f'); R(x, 66, 5, 1, '#ffd84a'); }
    } else if (id === 'watergun') {
      [20, 220].forEach((px, side) => { for (let i = 0; i < 12; i++) { const k = (t * 1.4 + i / 12) % 1; R(px + (side ? -1 : 1) * k * 34, 90 - Math.sin(k * Math.PI) * 30, 2, 2, i % 2 ? '#5ab0f0' : '#d8f2ff'); } R(px - 3, 92, 6, 12, CFG.COLOR.ink); R(px - 2, 93, 4, 10, side ? '#ff8a2a' : '#7ccf6a'); });
    } else { // 풍선(발렌타인·화이트데이는 하트 모양)
      const heart = id === 'valentine' || id === 'whiteday';
      const cols = id === 'valentine' ? ['#e0456a', '#ff9fc2'] : id === 'whiteday' ? ['#ffffff', '#bfe0ff'] : ['#ff5a5a', '#ffd84a', '#5ab0f0', '#7ccf6a'];
      [20, 40, 192, 220].forEach((x, i) => {
        const y = 58 + (i % 2) * 10 + Math.round(Math.sin(t * 2 + i) * 2), c = cols[i % cols.length];
        R(x, y + 5, 1, 104 - y - 5, '#5f7a92');
        if (heart) { disc(x - 3, y, 4, c); disc(x + 3, y, 4, c); for (let j = 0; j < 7; j++) R(x - 6 + j, y + 2 + j, 13 - j * 2, 1, c); }
        else { disc(x, y, 6, CFG.COLOR.ink); disc(x, y, 5, c); R(x - 2, y - 3, 2, 2, '#ffffff'); }
      });
    }
  }

  // y: 머리 꼭대기
  function umbrella(x, y, c) { R(x + 5, y - 2, 1, 14, CFG.COLOR.ink); R(x - 7, y - 4, 18, 3, CFG.COLOR.ink); R(x - 6, y - 4, 16, 2, c); R(x - 3, y - 7, 10, 3, c); R(x + 1, y - 8, 2, 1, c); }
  function people(info, t) {
    const art = Cutscene.art, wet = info.weather === 'rain' || info.weather === 'snow';
    const person = (rows, pal, x, y, flip, brolly) => {
      const img = art.outlinedImg(rows, pal), px = Math.round(x), top = y - img.height + 1;
      R(px - 7, y - 1, 14, 2, 'rgba(20,50,77,0.22)');
      art.drawFacing(g, img, px, top, flip);
      if (brolly) umbrella(px, top, brolly);
    };
    const count = info.special ? 8 : info.show || info.id ? 6 : wet || info.weather === 'heat' ? 2 : 4; // 행사·공연일엔 붐빈다
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? -1 : 1, x = ((hash(i + 41, 300) + dir * t * (14 + hash(i, 10))) % 300 + 300) % 300 - 30;
      person(art.ME_WALK[Math.floor(t * 6 + i) % 4], art.NPC_PALS[(i * 3) % art.NPC_PALS.length], x, 107 + (i % 3) * 4, dir < 0, wet && ['#e0453f', '#3f8fe0', '#ffd84a', '#7ccf6a'][i % 4]);
    }
    // 주인공: 아침에는 가게 문으로 들어가고, 밤에는 문에서 나온다
    const k = Math.min(1, t / (DUR * 0.75)), open = info.kind === 'open', from = open ? 34 : 134, to = open ? 134 : 182;
    if (open && k >= 1) return;
    if (!open && t < 0.3) return;
    person(k < 1 ? art.ME_WALK[Math.floor(t * 6) % 4] : art.ME_FRONT, art.ME_PAL, from + (to - from) * k, 103, false, wet && '#2f80d0');
  }

  function weather(info, t) {
    if (info.weather === 'rain') for (let i = 0; i < 110; i++) R((hash(i + 61, 340) - t * 22 + 3400) % 340 - 50, (hash(i * 13 + 7, 150) + t * 160) % 150 - 5, 1, 4, 'rgba(210,232,255,0.8)');
    if (info.weather === 'snow') for (let i = 0; i < 90; i++) { const s = i % 4 ? 1 : 2; R((hash(i + 71, 340) + Math.sin(t * 1.5 + i) * 5 + 340) % 340 - 50, (hash(i * 11 + 3, 150) + t * (10 + i % 5 * 3)) % 150 - 5, s, s, '#ffffff'); }
    if (info.weather === 'heat') for (let i = 0; i < 6; i++) { const y = 112 - ((t * 7 + i * 6) % 24); for (let x = i * 44 - 30; x < i * 44 - 10; x += 2) R(x, y + Math.round(Math.sin(x / 3 + t * 6)), 2, 1, 'rgba(255,255,255,0.45)'); }
  }

  // t: 시작한 뒤 흐른 시간(초). W,H,OX: 화면 크기와 가운데 영역의 위치. ctx는 가운데 영역에 맞춰 옮겨진 상태로 받는다.
  // info: {kind 'open'|'close', season, weather, show, special, id(날짜 행사), eventName, dateText, shopName}
  function draw(ctx, t, info, W, H, OX) {
    const art = Cutscene.art.street, night = info.kind === 'close';
    const key = [info.season, info.weather, night].join();
    if (key !== bgKey) { bgKey = key; bg = art.build(theme(info, night)); }
    if (!layer) { layer = document.createElement('canvas'); layer.width = art.LW; layer.height = art.GH; g = layer.getContext('2d'); }
    const shutter = night ? Math.max(0, Math.min(1, (t - 1.1) / 1.2)) : 1 - Math.max(0, Math.min(1, (t - 0.5) / 1.2));

    g.clearRect(0, 0, art.LW, art.GH);
    g.save(); g.translate(art.EXT, 0);
    sky(info, night, t);
    art.shop(g, t, info.shopName, { shutter, night, snow: info.weather === 'snow' });
    decorations(info, t);
    people(info, t);
    weather(info, t);
    g.restore();

    const sc = Scene.geom(W, H);
    ctx.save();
    ctx.translate(-OX, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, sc.ox, sc.oy, art.LW * sc.sc, art.GH * sc.sc);
    ctx.drawImage(layer, sc.ox, sc.oy, art.LW * sc.sc, art.GH * sc.sc);
    UI.fitText(info.shopName, sc.ox + (art.EXT + 120) * sc.sc, sc.oy + 42 * sc.sc, 104 * sc.sc, 16 * sc.sc, '#ffffff');
    ctx.restore();

    UI.framed({ x: 20, y: 18, w: 300, h: info.eventName ? 82 : 58 }, '#ffffff', 3);
    UI.text(info.dateText, 34, 36, 22, CFG.COLOR.ink, 'left');
    UI.text(WEATHER_NAME[info.weather] + (info.special ? ' · 특별 공연' : info.show ? ' · 아레나 공연' : ''), 34, 62, 14, info.show || info.special ? CFG.COLOR.alert : CFG.COLOR.sub, 'left');
    if (info.eventName) UI.text('★ ' + info.eventName, 34, 86, 14, '#2f7d4a', 'left');
    UI.text(night ? '영업 종료' : '영업 시작!', 480, 538, 36, night ? '#ffffff' : CFG.COLOR.yellow, 'center', CFG.COLOR.ink, 8);
    UI.text('화면을 누르면 넘어가요', 940, 558, 14, '#ffffff', 'right', CFG.COLOR.ink, 4);
  }

  return { DUR, draw };
})();
