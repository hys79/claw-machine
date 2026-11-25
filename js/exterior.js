// 하루의 시작과 끝에 보여 주는 가게 바깥 모습(계절·날씨·행사). 계산 없이 그리기만 한다.
const Exterior = (function () {
  let canvas = null;
  const DUR = 3.0;               // 보여 주는 시간(초). 화면을 누르면 바로 넘어간다
  const GROUND = 420;            // 가게가 서 있는 땅의 높이
  const LEFT = -480, WIDE = 1920; // 넓은 화면의 양옆까지 칠한다

  // 계절별 색: 하늘(위, 아래), 땅, 나뭇잎(어두움, 밝음)
  const SEASON = {
    spring: { sky: ['#9fd3f5', '#fdeef0'], ground: '#b9dc8e', leaf: ['#f08fb4', '#ffc4d8'] },
    summer: { sky: ['#5fb8f0', '#d8f2ff'], ground: '#8ecb6f', leaf: ['#2f8a4a', '#62bd68'] },
    autumn: { sky: ['#8fc4e8', '#ffe9c9'], ground: '#d3b97a', leaf: ['#c9542b', '#f2a33a'] },
    winter: { sky: ['#a9c3dc', '#e9f0f7'], ground: '#cfd6dc', leaf: ['#7a6a58', '#9a8a76'] },
  };
  const WEATHER_NAME = { sunny: '맑음', cloudy: '흐림', rain: '비', snow: '눈', heat: '폭염' };

  const R = (x, y, w, h, c) => UI.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), c);
  const hash = (i, n) => { const v = Math.sin(i * 127.1) * 43758.5453; return (v - Math.floor(v)) * n; }; // 늘 같은 자리에 흩뿌리기
  const mix = (a, b, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.substr(i, 2), 16) * (1 - k) + parseInt(b.substr(i, 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const disc = (cx, cy, r, c) => { for (let y = -r; y < r; y += 4) { const w = Math.round(Math.sqrt(Math.max(0, r * r - (y + 2) * (y + 2))) / 4) * 4; R(cx - w, cy + y, w * 2, 4, c); } };

  function sky(info, night) {
    let [top, bottom] = SEASON[info.season].sky;
    if (info.weather === 'cloudy' || info.weather === 'snow') { top = mix(top, '#9aa8b6', 0.65); bottom = mix(bottom, '#d5dbe2', 0.65); }
    if (info.weather === 'rain') { top = mix(top, '#5f7488', 0.75); bottom = mix(bottom, '#aab8c4', 0.7); }
    if (info.weather === 'heat') { top = mix(top, '#ffb35c', 0.35); bottom = mix(bottom, '#ffe2a8', 0.55); }
    if (night) { top = mix(top, '#101a3a', 0.85); bottom = mix(bottom, '#4a3a6a', 0.75); }
    for (let i = 0; i < 20; i++) R(LEFT, i * GROUND / 20, WIDE, GROUND / 20 + 1, mix(top, bottom, i / 19));
  }
  function celestial(info, night, k, now) {
    const clear = info.weather === 'sunny' || info.weather === 'heat';
    if (night) {
      if (info.weather !== 'rain' && info.weather !== 'snow') for (let i = 0; i < 60; i++) if ((Math.floor(now * 3) + i) % 7) R(hash(i + 3, 1100) - 70, hash(i * 7 + 1, 170) + 8, 3, 3, '#ffffff');
      const full = info.id === 'chuseok'; // 추석에는 커다란 보름달
      disc(800, full ? 118 : 104, full ? 60 : 30, '#fff3c2');
      if (!full) disc(786, 96, 24, mix(SEASON[info.season].sky[0], '#101a3a', 0.85));
      else [[-16, -12, 12], [18, 8, 16], [-8, 24, 8]].forEach(([x, y, r]) => disc(800 + x, 118 + y, r, '#f0dd9a'));
      return;
    }
    if (clear) {
      const y = 180 - 80 * k, r = info.weather === 'heat' ? 48 : 34;
      disc(150, y, r + 12, 'rgba(255,240,170,0.45)');
      disc(150, y, r, info.weather === 'heat' ? '#ff9d3a' : '#ffe066');
    }
    const n = clear ? 2 : 6;
    for (let i = 0; i < n; i++) {
      const x = (hash(i + 11, 1300) + now * (8 + i * 2)) % 1300 - 200, y = 50 + hash(i * 5 + 2, 90), c = info.weather === 'rain' ? '#7d8d9c' : '#ffffff';
      R(x, y + 12, 120, 20, c); R(x + 20, y, 52, 16, c); R(x + 66, y + 6, 34, 10, c);
    }
  }
  // 멀리 보이는 아레나와 아파트
  function skyline(info, night, now) {
    for (let i = 0; i < 16; i++) {
      const x = LEFT + 60 + i * 118, h = 70 + hash(i + 5, 90);
      R(x, GROUND - h, 70, h, night ? '#2a3555' : '#b3c6d9');
      for (let y = 10; y < h - 12; y += 18) for (let c = 0; c < 3; c++) R(x + 10 + c * 20, GROUND - h + y, 10, 8, night ? ((i + y + c) % 3 ? '#ffd873' : '#3c496c') : '#e4eef6');
    }
    const ax = 640, show = info.show || info.special;
    if (show && night) for (let i = 0; i < 3; i++) { // 공연일 밤의 조명
      const sway = Math.sin(now * 2 + i * 2) * 60;
      for (let j = 0; j < 12; j++) R(ax + 50 + i * 90 + sway * j / 12 - j * 2, GROUND - 190 - j * 18, 8 + j * 4, 18, ['rgba(255,120,200,0.18)', 'rgba(130,200,255,0.18)', 'rgba(255,230,120,0.18)'][i]);
    }
    R(ax + 20, GROUND - 176, 240, 16, night ? '#4d8a5c' : '#78c47a');
    R(ax, GROUND - 160, 280, 160, night ? '#3b4d72' : '#cfe0ee');
    for (let x = 8; x < 276; x += 22) R(ax + x, GROUND - 146, 12, 146, night ? '#5a72a0' : '#8fcfe8');
    R(ax + 70, GROUND - 128, 140, 34, show ? (Math.floor(now * 4) % 2 ? '#e06ad0' : '#7a5de0') : night ? '#5a4aa0' : '#9a86d8');
    if (show) UI.text(info.special ? '★ 특별 공연' : '♪ 공연', ax + 140, GROUND - 111, 14, '#ffffff', 'center');
  }
  function tree(info, x, now) {
    const s = SEASON[info.season], snow = info.weather === 'snow';
    R(x - 7, GROUND - 60, 14, 60, '#7a5230');
    if (info.season === 'winter') { // 앙상한 가지
      [[-30, -86, 26], [6, -98, 26], [-20, -112, 18], [-4, -124, 8]].forEach(([dx, dy, w]) => { R(x + dx, GROUND + dy + 20, w, 6, '#7a5230'); if (snow || info.weather === 'cloudy') R(x + dx, GROUND + dy + 16, w, 5, '#ffffff'); });
      R(x - 4, GROUND - 110, 8, 52, '#7a5230');
    } else {
      disc(x, GROUND - 88, 40, s.leaf[0]); disc(x - 24, GROUND - 68, 24, s.leaf[0]); disc(x + 26, GROUND - 72, 24, s.leaf[0]);
      disc(x - 10, GROUND - 98, 22, s.leaf[1]);
    }
    if (info.season === 'spring' || info.season === 'autumn') for (let i = 0; i < 5; i++) { // 흩날리는 꽃잎·낙엽
      const k = (now * 0.35 + i / 5) % 1;
      R(x - 40 + i * 20 + Math.sin(now * 3 + i) * 10, GROUND - 80 + k * 100, 6, 4, s.leaf[i % 2]);
    }
  }
  function ground(info) {
    const s = SEASON[info.season];
    R(LEFT, GROUND, WIDE, 576 - GROUND, info.weather === 'snow' ? '#f4f8fc' : s.ground);
    R(LEFT, GROUND + 28, WIDE, 76, info.weather === 'snow' ? '#e3eaf2' : '#d9d3c4'); // 인도
    for (let x = LEFT; x < LEFT + WIDE; x += 64) R(x, GROUND + 28, 3, 76, 'rgba(20,50,77,0.12)');
    if (info.weather === 'rain') for (let i = 0; i < 14; i++) R(hash(i + 21, 1100) - 70, GROUND + 40 + hash(i * 3 + 4, 54), 50, 6, 'rgba(120,170,220,0.55)');
  }
  // 우리 가게. open: 0(셔터 내림) ~ 1(다 올림)
  function shop(info, night, open, now) {
    const w = 300 + info.shopLevel * 50, h = 190 + info.shopLevel * 8, x = 400 - w / 2, y = GROUND - h + 12;
    R(x - 4, y - 4, w + 8, h + 8, CFG.COLOR.ink);
    R(x, y, w, h, night ? '#cbb9c9' : '#fff1e8');
    R(x + 10, y + 10, w - 20, 40, CFG.COLOR.blue);
    UI.text(info.shopName, 400, y + 30, 22, '#ffffff', 'center', CFG.COLOR.ink, 4);
    for (let i = 0; i < Math.ceil((w + 20) / 28); i++) { const ax = x - 10 + i * 28, aw = Math.min(28, x + w + 10 - ax); R(ax, y + 56, aw, 22, i % 2 ? '#ffffff' : '#ff77a8'); R(ax + 4, y + 78, aw - 8, 6, i % 2 ? '#ffffff' : '#ff77a8'); }
    if (info.weather === 'snow') R(x - 8, y - 12, w + 16, 12, '#ffffff');
    const wy = y + 90, wh = GROUND + 8 - wy, dw = 64, gx = x + 14, gw = w - 28;
    R(gx - 3, wy - 3, gw + 6, wh + 3, CFG.COLOR.ink);
    R(gx, wy, gw, wh, open > 0.4 || !night ? '#ffe9a0' : '#3c496c');
    const count = Math.floor((gw - dw - 12) / 52); // 창 너머의 기계들
    for (let i = 0; i < count; i++) {
      const mx = gx + 8 + i * 52;
      R(mx, wy + 14, 42, wh - 14, CFG.COLOR.ink); R(mx + 3, wy + 17, 36, 14, i % 2 ? '#ff77a8' : '#6ab0f0');
      R(mx + 3, wy + 34, 36, 34, '#bfe8f7');
      [0, 1, 2].forEach((j) => R(mx + 6 + j * 11, wy + 54 + (j + i) % 2 * 4, 10, 14 - (j + i) % 2 * 4, ['#d9a06c', '#ff9a5c', '#7ccf6a', '#ffd84a', '#c58bf0'][(i + j) % 5]));
      R(mx + 3, wy + 72, 36, wh - 75, '#44a39a');
    }
    const dx = gx + gw - dw - 4;
    R(dx, wy + 4, dw, wh - 4, CFG.COLOR.ink); R(dx + 4, wy + 8, dw - 8, wh - 8, open > 0.4 ? '#fff8d8' : '#8fb6cc'); R(dx + dw - 16, wy + 52, 5, 12, CFG.COLOR.ink);
    const sh = wh * (1 - open); // 셔터
    if (sh > 1) { R(gx, wy, gw, sh, '#9fb0c0'); for (let sy = 8; sy < sh; sy += 12) R(gx, wy + sy, gw, 3, '#7a8ea2'); R(gx, wy + sh - 5, gw, 5, '#5f7a92'); }
    // 문 위의 안내판
    UI.framed({ x: x + w - 62, y: y - 26, w: 54, h: 22 }, open > 0.5 ? '#ffd84a' : '#8fa9be', 2);
    UI.text(open > 0.5 ? 'OPEN' : 'CLOSE', x + w - 35, y - 15, 14, CFG.COLOR.ink, 'center');
    return { x, y, w, h };
  }
  // 날짜 행사·동네 행사 장식
  function decorations(info, box, now) {
    const id = info.id;
    if (!id) return;
    const { x, y, w } = box;
    const bulbs = (cols) => { for (let i = 0; i <= w / 24; i++) R(x + i * 24, y + 52 + (i % 2) * 5, 8, 8, cols[(i + Math.floor(now * 3)) % cols.length]); };
    if (id === 'christmas') {
      bulbs(['#ff5a5a', '#ffd84a', '#5ad27a']);
      const tx = x + w + 64;
      for (let i = 0; i < 4; i++) { const hw = 18 + i * 12; R(tx - hw, GROUND - 130 + i * 28, hw * 2, 28, '#2f8a4a'); R(tx - hw + 8 + ((i * 17 + Math.floor(now * 4) * 11) % (hw * 2 - 16)), GROUND - 116 + i * 28, 8, 8, i % 2 ? '#ff5a5a' : '#ffd84a'); }
      R(tx - 7, GROUND - 18, 14, 26, '#7a5230'); R(tx - 8, GROUND - 146, 16, 16, '#ffd84a');
    } else if (id === 'halloween') {
      bulbs(['#ff8a2a', '#8a4fc0']);
      [x - 40, x + w + 34, x + w + 86].forEach((px, i) => { disc(px, GROUND - 12, 22 - i * 3, '#ff8a2a'); R(px - 3, GROUND - 38 + i * 4, 6, 8, '#3f6b2a'); R(px - 10, GROUND - 18, 6, 6, '#3a2200'); R(px + 4, GROUND - 18, 6, 6, '#3a2200'); R(px - 8, GROUND - 6, 16, 4, '#3a2200'); });
    } else if (id === 'chuseok' || id === 'seollal' || id === 'newyear' || id === 'nightmarket') {
      for (let i = 0; i < 6; i++) { const lx = x + 20 + i * (w - 52) / 5; R(lx + 5, y + 80, 3, 12, CFG.COLOR.ink); R(lx - 3, y + 92, 20, 24, i % 2 ? '#3f6fd8' : '#e0453f'); R(lx - 1, y + 98, 16, 4, '#ffd84a'); }
    } else if (id === 'watergun') { // 물줄기
      [x - 90, x + w + 90].forEach((px, side) => { for (let i = 0; i < 14; i++) { const k = (now * 1.4 + i / 14) % 1, d = side ? -1 : 1; R(px + d * k * 130, GROUND - 40 - Math.sin(k * Math.PI) * 110, 7, 7, i % 2 ? '#5ab0f0' : '#bfe8ff'); } R(px - 8, GROUND - 40, 16, 40, side ? '#ff8a2a' : '#7ccf6a'); });
    } else { // 풍선(어린이날, 화이트데이, 동네 행사)
      const cols = id === 'whiteday' ? ['#ffffff', '#bfe0ff'] : ['#ff5a5a', '#ffd84a', '#5ab0f0', '#7ccf6a'];
      [x - 70, x - 40, x + w + 40, x + w + 74].forEach((bx, i) => {
        const by = GROUND - 150 + (i % 2) * 30 + Math.sin(now * 2 + i) * 6;
        R(bx, by + 16, 2, GROUND - by - 16, '#5f7a92'); disc(bx, by, 18, cols[i % cols.length]);
      });
    }
  }
  function walkers(info, kind, now) {
    const wet = info.weather === 'rain' || info.weather === 'snow';
    const art = Cutscene.art, busy = info.special ? 14 : info.show || info.id ? 9 : info.weather === 'rain' || info.weather === 'snow' || info.weather === 'heat' ? 3 : 5;
    for (let i = 0; i < busy; i++) {
      const dir = i % 2 ? -1 : 1, x = ((hash(i + 41, 1200) + dir * now * (34 + hash(i, 30))) % 1200 + 1200) % 1200 - 120, y = GROUND + 62 + (i % 3) * 16;
      const pal = art.NPC_PALS[(i * 3) % art.NPC_PALS.length], img = art.outlinedImg(art.ME_WALK[Math.floor(now * 8 + i) % 4], pal);
      figure(img, x, y, dir < 0);
      if (wet) umbrella(x, y - img.height * 3, ['#e0453f', '#3f8fe0', '#ffd84a', '#7ccf6a'][i % 4]);
    }
    // 주인공: 아침에는 가게로 들어가고, 밤에는 가게에서 나온다
    const k = Math.min(1, now / (DUR * 0.75)), from = kind === 'open' ? 80 : 440, to = kind === 'open' ? 440 : 600;
    if (kind === 'open' && k >= 1) return;
    const me = art.outlinedImg(k < 1 ? art.ME_WALK[Math.floor(now * 8) % 4] : art.ME_FRONT, art.ME_PAL), mx = from + (to - from) * k;
    figure(me, mx, GROUND + 44, false);
    if (wet) umbrella(mx, GROUND + 44 - me.height * 3, '#2f80d0');
  }
  function figure(img, x, y, flip) {
    const ctx = canvas, s = 3;
    R(x - 18, y - 4, 36, 6, 'rgba(20,50,77,0.2)');
    ctx.save(); ctx.translate(Math.round(x), Math.round(y - img.height * s)); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width * s / 2, 0, img.width * s, img.height * s);
    ctx.restore();
  }
  function umbrella(x, y, c) { R(x + 12, y - 8, 3, 42, CFG.COLOR.ink); R(x - 20, y - 16, 52, 8, c); R(x - 12, y - 24, 36, 8, c); R(x + 3, y - 30, 6, 6, c); } // y: 머리 꼭대기
  function weatherFx(info, now) {
    if (info.weather === 'rain') for (let i = 0; i < 150; i++) { const x = (hash(i + 61, 1300) - now * 90 + 13000) % 1300 - 170, y = (hash(i * 13 + 7, 600) + now * 620) % 600 - 20; R(x, y, 2, 14, 'rgba(200,225,255,0.75)'); }
    if (info.weather === 'snow') for (let i = 0; i < 110; i++) { const x = (hash(i + 71, 1300) + Math.sin(now * 1.5 + i) * 18 + 1300) % 1300 - 170, y = (hash(i * 11 + 3, 600) + now * (40 + i % 5 * 12)) % 600 - 20, s = 3 + (i % 3) * 2; R(x, y, s, s, '#ffffff'); }
    if (info.weather === 'heat') for (let i = 0; i < 8; i++) { const y = GROUND + 10 - ((now * 24 + i * 22) % 90); for (let x = 40 + i * 120 - 100; x < 100 + i * 120 - 100; x += 8) R(x, y + Math.sin(x / 12 + now * 6) * 3, 8, 3, 'rgba(255,255,255,0.35)'); }
  }

  // t: 시작한 뒤 흐른 시간(초). info: {kind 'open'|'close', season, weather, show, special, id(행사), eventName, dateText, shopName, shopLevel}
  function draw(ctx, t, info) {
    canvas = ctx;
    const night = info.kind === 'close', k = Math.min(1, t / DUR);
    const shutter = Math.max(0, Math.min(1, (t - 0.5) / 1.2));
    const open = night ? 1 - Math.max(0, Math.min(1, (t - 1.1) / 1.2)) : shutter;
    sky(info, night); celestial(info, night, k, t); skyline(info, night, t); ground(info);
    tree(info, 70, t); tree(info, 932, t); tree(info, -200, t); tree(info, 1160, t);
    const box = shop(info, night, open, t);
    decorations(info, box, t);
    if (night) R(LEFT, GROUND, WIDE, 576 - GROUND, 'rgba(20,30,70,0.3)');
    walkers(info, info.kind, t);
    weatherFx(info, t);
    UI.framed({ x: 20, y: 18, w: 330, h: info.eventName ? 82 : 58 }, '#ffffff', 3);
    UI.text(info.dateText, 34, 36, 22, CFG.COLOR.ink, 'left');
    UI.text(WEATHER_NAME[info.weather] + (info.special ? ' · 특별 공연' : info.show ? ' · 아레나 공연' : ''), 34, 62, 14, info.show || info.special ? CFG.COLOR.alert : CFG.COLOR.sub, 'left');
    if (info.eventName) UI.text('★ ' + info.eventName, 34, 86, 14, '#2f7d4a', 'left');
    UI.text(night ? '영업 종료' : '영업 시작!', 480, 538, 36, night ? '#ffffff' : CFG.COLOR.yellow, 'center', CFG.COLOR.ink, 8);
    UI.text('화면을 누르면 넘어가요', 940, 558, 14, '#ffffff', 'right', CFG.COLOR.ink, 4);
  }

  return { DUR, draw };
})();
