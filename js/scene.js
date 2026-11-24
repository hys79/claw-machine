// 메인 화면 배경(도트 풍경). 240x144 도트를 한 번만 그려 두고 4배로 확대해 보여 준다.
// 창동 아레나를 모티브로 한 오리지널 도트 그림이다(실제 사진을 따라 그리지 않음).
const Scene = (function () {
  const GW = 240, GH = 144, K = 4;
  const P = DATA.SCENE_PAL;
  let g = null; // 현재 그리는 레이어의 컨텍스트
  let layers = null;

  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = GW; c.height = GH;
    return c;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  }
  function R(x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      R(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }
  function circle(cx, cy, r, c) { ellipse(cx, cy, r, r, c); }
  function sprite(rows, x, y) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = DATA.PALETTE[row[i]];
        if (c) R(x + i, y + j, 1, 1, c);
      }
    });
  }
  const pathCx = (y) => 120 + 8 * Math.sin((y - 102) * 0.09);
  const pathHalf = (y) => 10 + (y - 102) * 0.9;

  // ---------- 하늘 + 햇살 ----------
  function drawSky(ctx) {
    g = ctx;
    for (let i = 0; i < 9; i++) R(0, i * 12, GW, 12, mix(P.skyTop, P.skyBottom, i / 8));
    R(0, 108, GW, GH - 108, P.skyBottom);
    const sx = 120, sy = 44;
    for (let k = -7; k <= 7; k++) {
      const a = (k * 12) * Math.PI / 180, w = 3.2 * Math.PI / 180;
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(255,247,200,0.18)';
      for (let y = 0; y < sy; y++) {
        const dy = sy - y;
        const x0 = Math.round(sx + dy * Math.tan(a - w));
        const x1 = Math.round(sx + dy * Math.tan(a + w));
        g.fillRect(Math.max(0, Math.min(x0, x1)), y, Math.max(0, Math.min(GW, Math.max(x0, x1)) - Math.max(0, Math.min(x0, x1))), 1);
      }
    }
    circle(sx, sy, 20, 'rgba(255,243,184,0.45)');
    circle(sx, sy, 14, P.sunGlow);
    circle(sx, sy, 9, P.sunCore);
  }

  // ---------- 구름(움직이는 층) ----------
  function cloud(x, y, w) {
    R(x + 2, y + 3, w - 4, 3, P.cloud);
    R(x, y + 4, w, 2, P.cloud);
    R(x + 4, y + 1, Math.round(w / 3), 3, P.cloud);
    R(x + Math.round(w / 2), y, Math.round(w / 3), 4, P.cloud);
    R(x + 2, y + 6, w - 4, 1, P.cloudShade);
  }
  function drawClouds(ctx) {
    g = ctx;
    [[12, 12, 36], [96, 6, 26], [158, 16, 42], [30, 40, 30], [196, 42, 32]].forEach((c) => cloud(c[0], c[1], c[2]));
  }

  // ---------- 앞 풍경 ----------
  function drawFront(ctx) {
    g = ctx;
    const rnd = rng(20260101);

    // 먼 산 두 겹
    for (let x = 0; x < GW; x++) {
      const t1 = Math.round(70 - (12 * Math.sin(x * 0.045 + 0.6) + 8 * Math.sin(x * 0.11 + 2) + ((x < 55 || x > 185) ? 7 : 0)));
      R(x, t1, 1, 96 - t1, P.mtnBack);
      const t2 = Math.round(82 - (7 * Math.sin(x * 0.07 + 1) + 5 * Math.sin(x * 0.16)));
      R(x, t2, 1, 96 - t2, P.mtnFront);
    }
    // 뒤쪽 아파트 단지
    for (let x = -2; x < GW;) {
      const w = 8 + Math.floor(rnd() * 5), h = 16 + Math.floor(rnd() * 18);
      const col = [P.aptA, P.aptB, P.aptC][Math.floor(rnd() * 3)];
      R(x, 96 - h, w, h, col);
      R(x + w - 2, 96 - h, 2, h, 'rgba(40,70,100,0.12)');
      for (let wy = 96 - h + 3; wy < 93; wy += 3)
        for (let wx = x + 1; wx < x + w - 2; wx += 3)
          R(wx, wy, 1, 1, rnd() < 0.12 ? P.aptWarm : P.aptWin);
      x += w + 1;
    }

    // 잔디(완만한 언덕 + 점 무늬)
    for (let x = 0; x < GW; x++) {
      const top = Math.round(95 + 1.6 * Math.sin(x * 0.07));
      for (let y = top; y < GH; y++) R(x, y, 1, 1, y < 112 ? P.lawnA : (y < 130 ? P.lawnB : P.lawnC));
    }
    for (let i = 0; i < 380; i++) {
      const x = Math.floor(rnd() * GW), y = 98 + Math.floor(rnd() * 46);
      R(x, y, 1, 1, rnd() < 0.6 ? P.lawnLight : P.lawnDark);
    }
    // 강(오른쪽)
    for (let y = 97; y < GH; y++) {
      const x0 = Math.round(192 + (y - 97) * 0.5);
      R(x0, y, GW - x0, 1, P.river);
      R(x0, y, 1, 1, P.riverEdge);
      if (rnd() < 0.5) R(x0 + 3 + Math.floor(rnd() * (GW - x0 - 4)), y, 2, 1, '#d5f0fc');
    }

    // 왼쪽 부속 건물 + LED 화면 + 작은 유리 돔
    R(28, 78, 38, 21, P.annex);
    R(28, 78, 38, 2, P.annexRoof);
    R(28, 97, 38, 2, P.annexRoof);
    for (let i = 0; i < 22; i++) R(34 + i, 83, 1, 9, mix(P.led1, P.led2, i / 21));
    for (let i = 0; i < 16; i++) R(34 + Math.floor(rnd() * 22), 83 + Math.floor(rnd() * 9), 1, 1, '#ffffff');
    R(33, 82, 24, 1, P.outline); R(33, 92, 24, 1, P.outline);
    for (let y = 84; y <= 98; y++) {
      const half = Math.round(12 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 98) / 15, 2))));
      R(14 - half, y, half * 2 + 1, 1, P.dome);
      R(14 - half, y, 1, 1, '#5d88ab'); R(14 + half, y, 1, 1, '#5d88ab');
    }
    R(8, 88, 6, 1, P.domeHi); R(6, 90, 2, 2, P.domeHi);

    // ----- 아레나 본체 -----
    ellipse(120, 50, 54, 9, P.rim);
    ellipse(120, 50, 51, 7, P.roof);
    for (let i = 0; i < 40; i++) R(78 + Math.floor(rnd() * 84), 46 + Math.floor(rnd() * 8), 2, 1, P.roofDark);
    ellipse(120, 49, 31, 4, P.oculus);
    R(100, 47, 40, 1, P.oculusHi);
    for (let x = 66; x <= 174; x++) {
      const dx = (x - 120) / 54;
      const arc = Math.round(9 * Math.sqrt(Math.max(0, 1 - dx * dx)));
      const top = 50 + arc, bot = 86 + arc;
      const ad = Math.abs(dx);
      let base = (Math.floor((x - 66) / 3) % 2) ? P.glassB : P.glassA;
      if (ad > 0.8) base = mix(base, P.glassEdge, 0.55);
      else if (ad < 0.3) base = mix(base, '#ffffff', 0.35);
      for (let y = top; y <= bot; y++) R(x, y, 1, 1, y > top + 15 ? mix(base, P.glassWarm, 0.28) : base);
      R(x, top - 2, 1, 2, P.rimLight);
      R(x, top + 15, 1, 1, P.ledge);
      R(x, bot, 1, 1, P.outline);
    }
    R(66, 50, 1, 37, P.outline); R(174, 50, 1, 37, P.outline);
    for (let i = 0; i < 90; i++) {
      const x = 69 + Math.floor(rnd() * 102), y = 62 + Math.floor(rnd() * 28);
      R(x, y, 1, 1, rnd() < 0.7 ? '#ffffff' : '#fff2b0');
    }
    // 아래쪽 곡선 테라스
    for (let y = 88; y <= 104; y++) {
      const half = Math.round(63 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 93) / 11, 2))));
      R(120 - half, y, half * 2, 1, y < 97 ? P.skirtTop : (y < 101 ? P.skirtMid : P.skirtDark));
      R(120 - half - 1, y, 1, 1, P.outline); R(120 + half, y, 1, 1, P.outline);
    }
    R(111, 79, 18, 12, P.doorFrame); R(112, 80, 16, 10, P.door); R(119, 80, 2, 10, P.doorFrame);

    // 광장 길(아레나 입구에서 아래로)
    for (let y = 103; y < GH; y++) {
      const c = pathCx(y), h = pathHalf(y);
      R(c - h, y, h * 2, 1, P.path);
      R(c - h, y, 1, 1, P.pathEdge); R(c + h - 1, y, 1, 1, P.pathEdge);
      if (rnd() < 0.5) R(c - h + 2 + Math.floor(rnd() * (h * 2 - 4)), y, 1, 1, P.pathLight);
    }

    // 나무들
    [[14, 106, 7], [32, 114, 6], [58, 104, 6], [78, 110, 4], [172, 108, 5], [194, 104, 7], [214, 100, 6], [228, 112, 8]].forEach((t) => {
      R(t[0] - 1, t[1] + t[2] - 2, 2, 5, P.trunk);
      circle(t[0], t[1], t[2] + 1, P.treeDark);
      circle(t[0], t[1], t[2], P.tree);
      circle(t[0] - Math.round(t[2] / 3), t[1] - Math.round(t[2] / 3), Math.max(2, Math.round(t[2] * 0.55)), P.treeLight);
    });

    // 가로등과 깃발
    [[92, 104], [148, 104], [78, 122], [162, 122]].forEach((l, i) => {
      R(l[0], l[1], 1, 14, '#5b6b7d');
      R(l[0] - 1, l[1] - 1, 3, 2, '#ffe27a');
      R(l[0] + 1, l[1] + 2, 3, 3, ['#ff77a8', '#4aa3f0', '#ffd84a', '#7ed36f'][i]);
    });

    // 관객들(작은 점 사람)
    const body = ['#e0556f', '#4a7fd8', '#f2b84b', '#6bc16a', '#a56bd8', '#ffffff', '#2d4a66'];
    for (let i = 0; i < 34; i++) {
      const y = 106 + Math.floor(rnd() * 28);
      const c = pathCx(y), h = pathHalf(y) - 3;
      const x = Math.round(c + (rnd() * 2 - 1) * h);
      R(x, y, 1, 1, '#f0c9a0');
      R(x, y + 1, 1, 2, body[Math.floor(rnd() * body.length)]);
    }

    // 앞쪽 덤불
    [[4, 140, 9], [236, 142, 10], [60, 148, 8], [180, 148, 8]].forEach((b) => {
      circle(b[0], b[1], b[2], P.lawnDark);
      circle(b[0] - 1, b[1] - 1, b[2] - 2, P.tree);
      circle(b[0] - 3, b[1] - 3, Math.max(2, Math.round(b[2] / 3)), P.treeLight);
    });

    // 인형뽑기 기계(길 양옆)
    sprite(DATA.CLAW_MACHINE, 28, 100);
    sprite(DATA.CLAW_MACHINE, 196, 100);

    // 꽃
    const fl = ['#ff77a8', '#ffffff', '#ffd84a', '#c9a6ff'];
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rnd() * GW), y = 112 + Math.floor(rnd() * 32);
      if (Math.abs(x - pathCx(y)) < pathHalf(y) + 1) continue;
      if (x > 192 + (y - 97) * 0.5 - 1) continue;
      R(x, y, 1, 1, fl[Math.floor(rnd() * fl.length)]);
    }
  }

  function build() {
    const sky = makeLayer(), clouds = makeLayer(), front = makeLayer();
    drawSky(sky.getContext('2d'));
    drawClouds(clouds.getContext('2d'));
    drawFront(front.getContext('2d'));
    layers = { sky, clouds, front };
  }

  // t: 초 단위 시간. 구름과 새가 천천히 움직인다.
  function draw(ctx, t) {
    if (!layers) build();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layers.sky, 0, 0, GW * K, GH * K);
    const ox = (t * 0.6) % GW;
    ctx.drawImage(layers.clouds, ox * K, 0, GW * K, GH * K);
    ctx.drawImage(layers.clouds, (ox - GW) * K, 0, GW * K, GH * K);
    ctx.drawImage(layers.front, 0, 0, GW * K, GH * K);
    ctx.fillStyle = P.bird;
    for (let i = 0; i < 3; i++) {
      const bx = Math.floor(((t * 7 + i * 83) % (GW + 30)) - 15);
      const by = Math.floor(24 + i * 11 + 2 * Math.sin(t * 2 + i));
      const up = Math.floor(t * 4 + i) % 2 === 0;
      const dots = up ? [[0, 0], [2, 0], [1, 1]] : [[0, 1], [2, 1], [1, 0]];
      dots.forEach((d) => ctx.fillRect((bx + d[0]) * K, (by + d[1]) * K, K, K));
    }
  }

  return { draw };
})();
