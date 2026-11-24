// 메인 화면 배경(도트 풍경). 240x144 도트를 한 번만 그려 두고 4배로 확대해 보여 준다.
// 창동 아레나를 모티브로 한 오리지널 도트 그림이다(실제 사진을 따라 그리지 않음).
const Scene = (function () {
  const GW = 240, GH = 144, K = 4;
  const EXT = 60;           // 좌우로 더 그리는 여분(넓은 화면용)
  const LW = GW + EXT * 2;  // 레이어 전체 너비
  const P = DATA.SCENE_PAL;
  let g = null; // 현재 그리는 레이어의 컨텍스트

  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = LW; c.height = GH;
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
    g.translate(EXT, 0);
    for (let i = 0; i < 9; i++) R(-EXT, i * 12, LW, 12, mix(P.skyTop, P.skyBottom, i / 8));
    R(-EXT, 108, LW, GH - 108, P.skyBottom);
    const sx = 120, sy = 44;
    for (let k = -7; k <= 7; k++) {
      const a = (k * 12) * Math.PI / 180, w = 3.2 * Math.PI / 180;
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.14)' : 'rgba(255,247,200,0.18)';
      for (let y = 0; y < sy; y++) {
        const dy = sy - y;
        const x0 = Math.round(sx + dy * Math.tan(a - w));
        const x1 = Math.round(sx + dy * Math.tan(a + w));
        const lo = Math.max(-EXT, Math.min(x0, x1)), hi = Math.min(GW + EXT, Math.max(x0, x1));
        if (hi > lo) g.fillRect(lo, y, hi - lo, 1);
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
    g.translate(EXT, 0);
    [[12, 12, 36], [96, 6, 26], [158, 16, 42], [30, 40, 30], [196, 42, 32], [-44, 16, 34], [-20, 46, 28], [262, 10, 38], [272, 40, 30]].forEach((c) => cloud(c[0], c[1], c[2]));
  }

  // ---------- 아레나(원통형 드럼 건물) ----------
  // 지붕(잔디 링 + 천창) → 유리 외벽(세로 살대·층 구분선·반사) → 처마·기단 → 정문 캐노피와 계단
  function drawArena(rnd) {
    const CX = 120, TY = 44, RX = 56, RY = 10, BODY = 40;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // 바닥 테라스(계단 3단)
    ellipse(CX, 88, 68, 15, P.terraceEdge);
    ellipse(CX, 87, 66, 13, P.terraceA);
    ellipse(CX, 87, 62, 11, P.terraceB);
    ellipse(CX, 86, 60, 10, P.terraceA);

    // 지붕: 콘크리트 테두리 + 잔디 링 + 가운데 천창
    ellipse(CX, TY, RX + 1, RY + 1, P.outline);
    ellipse(CX, TY, RX, RY, P.rimLight);
    ellipse(CX, TY, RX - 4, RY - 3, P.roofDark);
    ellipse(CX, TY, RX - 5, RY - 4, P.roof);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.4;
      R(CX + Math.cos(a) * (RX - 6) * r, TY + Math.sin(a) * (RY - 4) * r, 1, 1, rnd() < 0.5 ? P.roofLight : P.roofDark);
    }
    ellipse(CX, TY, 34, 5, P.skylightEdge);
    ellipse(CX, TY, 33, 4, P.skylight);
    ellipse(CX - 4, TY - 1, 22, 2, P.skylightHi);
    for (let x = CX - 28; x <= CX + 28; x += 7) R(x, TY - 3, 1, 7, P.skylightEdge); // 천창 살대
    // 테두리 조명 점
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2;
      R(CX + Math.cos(a) * (RX - 1), TY + Math.sin(a) * (RY - 1), 1, 1, Math.sin(a) > 0 ? '#fff6c8' : '#ffffff');
    }

    // 외벽
    for (let x = CX - RX; x <= CX + RX; x++) {
      const dx = (x - CX) / RX;
      const arc = Math.round(RY * Math.sqrt(Math.max(0, 1 - dx * dx)));
      const top = TY + arc, bot = TY + BODY + arc;
      // 둥근 몸통의 명암: 왼쪽 위가 밝고 오른쪽이 어둡다
      const lit = clamp(1 - Math.abs(dx + 0.35) * 1.6, 0, 1);
      const dark = clamp((dx - 0.05) * 0.7, 0, 0.55) + (dx < -0.8 ? 0.15 : 0);
      const shadeTo = (hexc) => dark > 0 ? mix(hexc, P.glassShade, dark) : mix(hexc, '#ffffff', lit * 0.3);

      // 처마(콘크리트 띠)
      for (let y = top; y < top + 5; y++) R(x, y, 1, 1, shadeTo(y === top + 4 ? P.concreteShade : P.concrete));
      // 유리면
      const pane = Math.floor((x - (CX - RX)) / 4);
      const mull = (x - (CX - RX)) % 4 === 0;
      const gTop = top + 5, gBot = bot - 7;
      const mid = Math.round((gTop + gBot) / 2);
      for (let y = gTop; y <= gBot; y++) {
        let base = mull ? P.glassShade : (pane % 2 ? P.glassMid : P.glassLight);
        if (y > mid + 2) base = mull ? P.glassShade : (pane % 2 ? P.glassDeep : P.glassMid);
        if (y === mid || y === mid + 1) base = P.glassShade;      // 층 구분선
        let c = shadeTo(base);
        if (!mull && ((x * 1 + y * 2) % 29) < 2 && y > gTop + 1 && y < gBot - 1) c = mix(base, '#ffffff', 0.45); // 사선 반사
        R(x, y, 1, 1, c);
      }
      // 기단(콘크리트)
      for (let y = bot - 6; y <= bot - 1; y++) R(x, y, 1, 1, shadeTo(y >= bot - 2 ? P.concreteDark : P.concreteShade));
      R(x, bot, 1, 1, P.outline);
    }
    // 좌우 윤곽선
    R(CX - RX, TY, 1, BODY + 1, P.outline);
    R(CX + RX, TY, 1, BODY + 1, P.outline);
    // 반짝이는 창(공연장 불빛)
    for (let i = 0; i < 36; i++) {
      const x = CX - 50 + Math.floor(rnd() * 100), y = 58 + Math.floor(rnd() * 24);
      R(x, y, 1, 1, rnd() < 0.7 ? '#ffffff' : '#fff2b0');
    }
    // 외벽 위 대형 전광판 띠
    const bx0 = CX - 20, by0 = 63;
    R(bx0 - 1, by0 - 1, 42, 9, P.outline);
    for (let i = 0; i < 40; i++) R(bx0 + i, by0, 1, 7, mix(P.led1, P.led2, i / 39));
    for (let i = 0; i < 26; i++) R(bx0 + 1 + Math.floor(rnd() * 38), by0 + Math.floor(rnd() * 7), 1, 1, '#ffffff');

    // 정문 캐노피와 문
    R(CX - 19, 78, 38, 3, P.outline);
    R(CX - 18, 78, 36, 2, P.concreteLight);
    R(CX - 18, 80, 36, 1, P.concreteShade);
    R(CX - 17, 81, 2, 11, P.concreteShade);
    R(CX + 15, 81, 2, 11, P.concreteShade);
    R(CX - 15, 81, 30, 11, P.outline);
    R(CX - 14, 81, 28, 10, P.door);
    for (let x = CX - 14; x <= CX + 14; x += 7) R(x, 81, 1, 10, P.doorFrame);
    R(CX - 14, 85, 28, 1, P.doorFrame);
    R(CX - 14, 81, 28, 1, '#fff6d0');

    // 정문 앞 계단
    [[CX - 21, 42, 92], [CX - 24, 48, 93], [CX - 27, 54, 94], [CX - 30, 60, 95]].forEach((st, i) => {
      R(st[0], st[2], st[1], 1, i % 2 ? P.concreteShade : P.concreteLight);
      R(st[0], st[2] + 1, st[1], 1, P.concreteDark);
    });

    // 양옆 깃발 기둥
    [[CX - 40, 88], [CX + 40, 88]].forEach((f, i) => {
      R(f[0], f[1] - 16, 1, 17, P.outline);
      R(f[0] + 1, f[1] - 16, 7, 4, i ? '#4aa3f0' : '#ffd84a');
      R(f[0] + 1, f[1] - 12, 7, 1, P.outline);
    });
  }

  // ---------- 공사 중인 아레나(컷신용) ----------
  function drawSite(rnd) {
    const CX = 120, RX = 56, BODY = 40, RY = 10, TY = 44;
    // 흙바닥
    ellipse(CX, 90, 72, 16, '#a88a5c');
    ellipse(CX, 89, 68, 13, '#c9ad80');
    for (let i = 0; i < 90; i++) R(CX - 64 + Math.floor(rnd() * 128), 80 + Math.floor(rnd() * 20), 2, 1, rnd() < 0.5 ? '#b39565' : '#dcc497');
    // 아직 낮은 콘크리트 골조(기둥 + 바닥판)
    for (let x = CX - RX; x <= CX + RX; x++) {
      const dx = (x - CX) / RX;
      const arc = Math.round(RY * Math.sqrt(Math.max(0, 1 - dx * dx)));
      const bot = TY + BODY + arc, top = bot - 26;
      const col = (x - (CX - RX)) % 9 < 3;
      const dark = Math.max(0, dx - 0.05) * 0.5;
      for (let y = top; y <= bot; y++) {
        let c = col ? P.concrete : '#6f8296';                       // 기둥 / 뚫린 칸
        if (!col && y > top + 11 && y < top + 14) c = P.concreteShade; // 중간 바닥판
        if (y <= top + 2 || y >= bot - 1) c = P.concreteShade;        // 위·아래 슬래브
        R(x, y, 1, 1, dark > 0 ? mix(c.length === 7 ? c : '#6f8296', P.glassShade, dark) : c);
      }
      R(x, bot + 1, 1, 1, P.outline);
    }
    // 위로 삐죽 나온 철근
    for (let x = CX - RX + 4; x < CX + RX; x += 9) {
      const dx = (x - CX) / RX, arc = Math.round(RY * Math.sqrt(Math.max(0, 1 - dx * dx)));
      const top = TY + BODY + arc - 26;
      R(x, top - 12, 1, 12, '#8a5a3a');
      R(x + 1, top - 8, 1, 8, '#a8744c');
    }
    // 비계(주황 파이프 격자)
    for (let x = CX - 48; x <= CX + 48; x += 16) R(x, 52, 1, 46, '#f0a030');
    [58, 70, 82].forEach((y) => R(CX - 48, y, 97, 1, '#f0a030'));
    for (let x = CX - 48; x < CX + 48; x += 16) for (let k = 0; k < 12; k++) R(x + k, 58 + k, 1, 1, '#d98a20');
    // 타워크레인(오른쪽)
    for (let y = 8; y < 92; y++) {
      R(160, y, 1, 1, '#ffd84a'); R(163, y, 1, 1, '#ffd84a');
      if (y % 6 < 2) R(160, y, 4, 1, '#e0b020');
    }
    R(104, 8, 80, 2, '#ffd84a');
    for (let x = 106; x < 182; x += 6) R(x, 10, 1, 2, '#e0b020');
    R(176, 6, 10, 7, '#8795a5');
    R(157, 10, 8, 6, '#ffffff'); R(158, 11, 6, 3, P.glassMid);
    R(118, 10, 1, 30, '#44505c');
    R(116, 40, 5, 3, '#ffd84a'); R(116, 43, 5, 1, '#44505c');
    // 울타리(파랑·흰 패널) + 공사 안내 줄무늬
    for (let x = 22; x < 218; x += 8) {
      R(x, 99, 8, 7, '#4a90d9'); R(x, 99, 8, 1, '#ffffff'); R(x, 105, 8, 1, '#2f5f9f');
      R(x + 7, 98, 1, 9, '#2d4a66');
    }
    for (let x = 90; x < 150; x += 6) { R(x, 94, 3, 4, '#ffd84a'); R(x + 3, 94, 3, 4, '#2d4a66'); }
    // 완공 예정도 간판(왼쪽)
    R(26, 62, 44, 28, P.outline); R(27, 63, 42, 26, '#ffffff');
    R(29, 65, 38, 22, '#cfe8f8');
    ellipse(48, 76, 13, 3, '#dfe6ee'); R(36, 76, 25, 6, '#9fd6e8'); ellipse(48, 82, 13, 3, '#7ab8d6');
    ellipse(48, 76, 12, 2, '#78c47a');
    R(32, 66, 6, 3, '#ffffff'); R(55, 67, 8, 3, '#ffffff');
    R(36, 90, 2, 8, '#2d4a66'); R(58, 90, 2, 8, '#2d4a66');
  }

  // ---------- 앞 풍경 ----------
  function drawFront(ctx, variant) {
    g = ctx;
    g.translate(EXT, 0);
    const rnd = rng(20260101);

    // 먼 산 두 겹
    for (let x = -EXT; x < GW + EXT; x++) {
      const t1 = Math.round(70 - (12 * Math.sin(x * 0.045 + 0.6) + 8 * Math.sin(x * 0.11 + 2) + ((x < 55 || x > 185) ? 7 : 0)));
      R(x, t1, 1, 96 - t1, P.mtnBack);
      const t2 = Math.round(82 - (7 * Math.sin(x * 0.07 + 1) + 5 * Math.sin(x * 0.16)));
      R(x, t2, 1, 96 - t2, P.mtnFront);
    }
    // 뒤쪽 아파트 단지
    for (let x = -EXT - 2; x < GW + EXT;) {
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
    for (let x = -EXT; x < GW + EXT; x++) {
      const top = Math.round(95 + 1.6 * Math.sin(x * 0.07));
      for (let y = top; y < GH; y++) R(x, y, 1, 1, y < 112 ? P.lawnA : (y < 130 ? P.lawnB : P.lawnC));
    }
    for (let i = 0; i < 380; i++) {
      const x = -EXT + Math.floor(rnd() * LW), y = 98 + Math.floor(rnd() * 46);
      R(x, y, 1, 1, rnd() < 0.6 ? P.lawnLight : P.lawnDark);
    }
    // 강(오른쪽)
    for (let y = 97; y < GH; y++) {
      const x0 = Math.round(192 + (y - 97) * 0.5);
      R(x0, y, GW + EXT - x0, 1, P.river);
      R(x0, y, 1, 1, P.riverEdge);
      if (rnd() < 0.5) R(x0 + 3 + Math.floor(rnd() * (GW + EXT - x0 - 4)), y, 2, 1, '#d5f0fc');
    }

    g.save();
    g.translate(-18, 0); // 아레나 광장과 겹치지 않게 왼쪽으로 비킨다
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
    g.restore();

    if (variant === 'site') drawSite(rnd); else drawArena(rnd);

    // 광장 길(아레나 입구에서 아래로)
    for (let y = 103; y < GH; y++) {
      const c = pathCx(y), h = pathHalf(y);
      R(c - h, y, h * 2, 1, P.path);
      R(c - h, y, 1, 1, P.pathEdge); R(c + h - 1, y, 1, 1, P.pathEdge);
      if (rnd() < 0.5) R(c - h + 2 + Math.floor(rnd() * (h * 2 - 4)), y, 1, 1, P.pathLight);
    }

    // 나무들
    [[-46, 108, 7], [-24, 102, 6], [-8, 116, 5], [14, 106, 7], [32, 114, 6], [58, 104, 6], [78, 110, 4], [172, 108, 5], [194, 104, 7], [214, 100, 6], [228, 112, 8]].forEach((t) => {
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

    // 꽃
    const fl = ['#ff77a8', '#ffffff', '#ffd84a', '#c9a6ff'];
    for (let i = 0; i < 70; i++) {
      const x = -EXT + Math.floor(rnd() * LW), y = 112 + Math.floor(rnd() * 32);
      if (Math.abs(x - pathCx(y)) < pathHalf(y) + 1) continue;
      if (x > 192 + (y - 97) * 0.5 - 1) continue;
      R(x, y, 1, 1, fl[Math.floor(rnd() * fl.length)]);
    }
  }

  const cache = {};
  function build(variant) {
    const sky = makeLayer(), clouds = makeLayer(), front = makeLayer();
    drawSky(sky.getContext('2d'));
    drawClouds(clouds.getContext('2d'));
    drawFront(front.getContext('2d'), variant);
    return (cache[variant || 'arena'] = { sky, clouds, front });
  }

  // 화면(w×h)을 덮는 배율과 위치. 컷신이 같은 좌표계로 그리도록 따로 내보낸다.
  function geom(w, h) {
    const sc = Math.max(w / LW, h / GH);
    return { sc, ox: (w - LW * sc) / 2, oy: (h - GH * sc) / 2, EXT };
  }

  // t: 초 단위 시간. w,h: 그릴 영역 크기(화면을 꽉 채우도록 확대해서 덮는다).
  function draw(ctx, t, w, h, variant) {
    const layers = cache[variant || 'arena'] || build(variant);
    w = w || GW * K; h = h || GH * K;
    ctx.imageSmoothingEnabled = false;
    // 높이에 맞춰 확대(기본 4배). 화면이 더 넓으면 양옆 풍경을 더 보여 준다.
    const sc = Math.max(w / LW, h / GH);
    const ox = (w - LW * sc) / 2, oy = (h - GH * sc) / 2;
    ctx.drawImage(layers.sky, ox, oy, LW * sc, GH * sc);
    const cx = ((t * 0.6) % LW) * sc;
    ctx.drawImage(layers.clouds, ox + cx, oy, LW * sc, GH * sc);
    ctx.drawImage(layers.clouds, ox + cx - LW * sc, oy, LW * sc, GH * sc);
    ctx.drawImage(layers.front, ox, oy, LW * sc, GH * sc);
    ctx.fillStyle = P.bird;
    for (let i = 0; i < 3; i++) {
      const bx = Math.floor(((t * 7 + i * 83) % (LW + 30)) - 15) + EXT;
      const by = Math.floor(24 + i * 11 + 2 * Math.sin(t * 2 + i));
      const up = Math.floor(t * 4 + i) % 2 === 0;
      const dots = up ? [[0, 0], [2, 0], [1, 1]] : [[0, 1], [2, 1], [1, 0]];
      dots.forEach((d) => ctx.fillRect(ox + (bx + d[0]) * sc, oy + (by + d[1]) * sc, sc, sc));
    }
  }

  return { draw, geom };
})();
