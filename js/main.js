// 진입점: 타이틀 → 프롤로그(이름 입력 포함) → 가게(준비 중). 마우스/터치/키보드 공용.
// 캔버스는 창 전체를 채운다. 높이(576)는 고정, 너비(W)는 창 비율에 맞춰 늘어나며,
// UI는 가운데 960 영역(OX만큼 이동)에 그리고 배경 그림은 전체 폭을 덮는다.
// 버튼은 UI.button이 그리면서 클릭 영역도 등록한다(규칙: docs/UI_GUIDE.md).
(function () {
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const wrap = document.getElementById('wrap');
  const input = document.getElementById('nameInput');
  const C = CFG.COLOR;
  const L = CFG.LAYOUT;
  const H = CFG.H;
  const DW = CFG.DESIGN_W;

  let W = DW;   // 현재 논리 너비
  let OX = 0;   // 가운데 UI 영역의 왼쪽 오프셋
  let scale = 1; // 논리 좌표 → CSS 픽셀
  let pxk = 1;   // 논리 좌표 → 캔버스 실제 픽셀(고해상도 화면에서 글자가 선명하도록 기기 픽셀 수만큼 키운다)

  let screen = 'title'; // title | intro | name | shop
  let modal = null;     // null | help | settings
  let confirmWipe = false;
  let nameError = '';
  let now = 0;

  State.load();

  // ---------- 창 크기에 맞추기 ----------
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    W = Math.max(CFG.MIN_W, Math.min(CFG.MAX_W, Math.round(H * vw / vh)));
    OX = (W - DW) / 2;
    scale = Math.min(vw / W, vh / H);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(W * scale * dpr);
    cv.height = Math.round(H * scale * dpr);
    pxk = cv.width / W;
    wrap.style.width = Math.round(W * scale) + 'px';
    wrap.style.height = Math.round(H * scale) + 'px';
    fitInput();
  }

  // 입력칸 위치(가운데 960 영역 기준 논리 좌표). 이름 화면과 컷신의 가게 이름 입력이 같이 쓴다.
  let inputRect = { x: 240, y: 236, w: 480, h: 64 };
  function fitInput() {
    input.style.left = Math.round((OX + inputRect.x) * scale) + 'px';
    input.style.top = Math.round(inputRect.y * scale) + 'px';
    input.style.width = Math.round(inputRect.w * scale) + 'px';
    input.style.height = Math.round(inputRect.h * scale) + 'px';
    input.style.fontSize = Math.max(14, Math.round(inputRect.h * 0.5 * scale / 14) * 14) + 'px'; // 도트 폰트는 14의 배수일 때 또렷하다
  }
  function showInput(show, rect, max, placeholder) {
    if (show) {
      inputRect = rect;
      input.maxLength = max;
      input.placeholder = placeholder;
      input.value = '';
      input.style.display = 'block';
      fitInput();
      setTimeout(() => input.focus(), 0);
    } else {
      input.style.display = 'none';
      input.blur();
    }
  }

  // ---------- 작은 도구 ----------
  // 도트 스프라이트를 작은 이미지로 한 번 만들어 두고 확대해서 그린다(칸마다 칠하면 틈이 생긴다).
  // outline을 주면 그 색의 테두리(t 픽셀)를 둘러 그림 위에서도 또렷하게 보이게 한다.
  const spriteCache = new Map();
  function spriteImg(rows, tint) {
    const key = rows;
    let m = spriteCache.get(key);
    if (!m) { m = {}; spriteCache.set(key, m); }
    const k = tint || 'color';
    if (!m[k]) {
      const img = document.createElement('canvas');
      img.width = rows[0].length;
      img.height = rows.length;
      const g = img.getContext('2d');
      rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const c = tint ? (row[i] === '.' ? null : tint) : DATA.PALETTE[row[i]];
          if (!c) continue;
          g.fillStyle = c;
          g.fillRect(i, j, 1, 1);
        }
      });
      m[k] = img;
    }
    return m[k];
  }
  function sprite(rows, x, y, s, outline, t) {
    const img = spriteImg(rows);
    if (outline) {
      const sil = spriteImg(rows, outline);
      t = t || 2;
      [[-t, 0], [t, 0], [0, -t], [0, t], [-t, -t], [t, -t], [-t, t], [t, t]].forEach((d) =>
        ctx.drawImage(sil, x + d[0], y + d[1], sil.width * s, sil.height * s));
    }
    ctx.drawImage(img, x, y, img.width * s, img.height * s);
  }

  function won(n) { return n.toLocaleString('ko-KR') + '원'; }

  // 설정 버튼은 화면 오른쪽 위 모서리에 붙는다(전체 좌표)
  function settingsRect() {
    const s = CFG.SETTINGS_BTN;
    return { x: W - s.margin - s.size, y: s.margin, w: s.size, h: s.size };
  }

  function pointer(e) {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * W / r.width, y: (t.clientY - r.top) * H / r.height };
  }

  // ---------- 화면 전환 ----------
  function go(next) {
    screen = next;
    setModal(null);
    confirmWipe = false;
    nameError = '';
    showInput(next === 'name', { x: 240, y: 236, w: 480, h: 64 }, CFG.NAME_MAX, '이름 입력');
    if (next !== 'intro') Sound.ambient(null);
    if (next === 'intro') Cutscene.start(ct(), () => { State.data.rankIntro = true; State.save(); go('shop'); }, cutHooks); // 프롤로그 컷신
  }

  // 첫 시작: 주인공 이름을 정하고 컷신으로. 저장은 가게 이름까지 정한 뒤에 한다.
  function submitName() {
    const name = input.value.trim();
    if (!name) { nameError = '이름을 적어 줘!'; return; }
    State.data = State.fresh();
    State.data.playerName = name.slice(0, CFG.NAME_MAX);
    Sound.sfx('confirm');
    go('intro');
  }

  // 컷신이 가게 이름 입력칸을 띄우고 읽어 갈 때 쓰는 연결
  const cutHooks = {
    input: (show, rect) => showInput(show, rect, CFG.SHOP_NAME_MAX, '가게 이름 (최대 ' + CFG.SHOP_NAME_MAX + '글자)'),
    value: () => input.value,
  };

  // 팝업이 열려 있는 동안 컷신 시간은 멈춘다(설정을 열어도 이야기가 흘러가지 않게).
  let pausedAt = 0, pausedTotal = 0;
  const ct = () => (modal ? pausedAt : now) - pausedTotal;
  function setModal(m) {
    if (m && !modal) pausedAt = now;
    if (!m && modal) pausedTotal += now - pausedAt;
    modal = m;
    input.style.visibility = m ? 'hidden' : 'visible'; // 입력칸이 팝업 위로 떠 보이지 않게
  }
  function closeModal() { setModal(null); confirmWipe = false; }

  // ---------- 입력 ----------
  function onPress(e) {
    if (e.target === input) return;
    e.preventDefault();
    Sound.unlock(); // 첫 입력에서 소리를 켠다
    const p = pointer(e);
    UI.setMouse({ x: p.x, y: p.y, on: !e.touches }); // 터치는 호버 없음
    if (UI.click(p)) return;
    if (!modal && screen === 'intro') Cutscene.advance(ct()); // 빈 곳을 눌러도 진행
  }
  cv.addEventListener('mousedown', onPress);
  cv.addEventListener('touchstart', onPress, { passive: false });
  cv.addEventListener('mousemove', (e) => { const p = pointer(e); UI.setMouse({ x: p.x, y: p.y, on: true }); });
  window.addEventListener('mousemove', (e) => { UI.move(pointer(e)); });                       // 슬라이더 드래그(캔버스 밖으로 나가도 계속)
  cv.addEventListener('touchmove', (e) => { e.preventDefault(); UI.move(pointer(e)); }, { passive: false });
  window.addEventListener('mouseup', () => UI.release());
  window.addEventListener('touchend', () => UI.release());
  window.addEventListener('touchcancel', () => UI.release());
  cv.addEventListener('mouseleave', () => UI.setMouse({ x: -1, y: -1, on: false }));
  input.addEventListener('input', () => { nameError = ''; });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (screen === 'name') submitName(); else if (screen === 'intro') Cutscene.submit(ct());
  });
  window.addEventListener('resize', resize);

  // Esc: 팝업 닫기 → (타이틀·컷신에서는) 설정 열기 → 그 밖에는 이전 화면
  window.addEventListener('keydown', (e) => {
    Sound.unlock();
    if (e.key === 'Escape') {
      Sound.sfx('back');
      if (modal) closeModal();
      else if (screen === 'title' || screen === 'intro') setModal('settings');
      else go('title');
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target !== input && !modal && screen === 'intro') {
      e.preventDefault();
      Cutscene.advance(ct());
    }
  });

  // ---------- 화면별 그리기 ----------
  // 설정 아이콘: 상자 없이 톱니만(흰색 + 진한 테두리). 마우스를 올리면 1px 뜬다.
  function drawGearButton() {
    UI.button(settingsRect(), '', {
      bare: true,
      onClick: () => setModal('settings'),
      draw(x, y, w, h) {
        const gs = 2, gw = DATA.GEAR[0].length * gs;
        sprite(DATA.GEAR, x + (w - gw) / 2, y + (h - gw) / 2, gs, C.ink, 2);
      },
    });
  }

  function backButton(label) {
    UI.button(L.backBtn, label || '돌아가기', { style: 'secondary', onClick: () => go('title') });
  }

  // 타이틀 한 줄: 글자마다 크기·색이 다른 조각을 같은 밑줄(baseline)에 맞춰 가운데 정렬로 그린다.
  function titleRow(parts, cx, baseline) {
    let total = 0;
    const widths = parts.map((p) => {
      ctx.font = UI.font(p[1]);
      const w = Math.ceil(ctx.measureText(p[0]).width);
      total += w;
      return w;
    });
    let x = cx - total / 2;
    parts.forEach((p, i) => {
      UI.text(p[0], x, baseline - p[1] * 0.35, p[1], p[2] === 'yellow' ? C.yellow : C.white, 'left', C.ink, CFG.TITLE_OUTLINE);
      x += widths[i];
    });
  }

  function drawTitle() {
    Scene.draw(ctx, now, W, H);
    ctx.save();
    ctx.translate(OX, 0);
    titleRow(DATA.TITLE_ROWS[0], 480, 78);
    titleRow(DATA.TITLE_ROWS[1], 480, 150);
    UI.button(L.startBtn, State.hasSave() ? '이어하기' : '시작하기', {
      style: 'primary',
      onClick: () => { if (State.hasSave()) go('shop'); else go('name'); },
    });
    UI.button(L.helpBtn, '게임 설명', { style: 'secondary', onClick: () => setModal('help') });
    UI.button(L.creditsBtn, '크레딧', { style: 'secondary', onClick: () => setModal('credits') });
    ctx.restore();
    drawGearButton();
  }

  function drawIntro() {
    Cutscene.draw(ctx, ct(), W, H, OX);
    if (screen !== 'intro') return; // 마지막 장면이 끝나 가게 화면으로 넘어간 경우
    const g = settingsRect();
    ctx.save();
    ctx.translate(OX, 0);
    // 건너뛰기는 설정 아이콘 왼쪽에 둔다
    UI.button({ x: g.x - 14 - L.skipBtn.w - OX, y: g.y - 2, w: L.skipBtn.w, h: L.skipBtn.h }, '건너뛰기', { style: 'secondary', size: 18, onClick: () => Cutscene.skip(ct()) });
    ctx.restore();
    drawGearButton();
  }

  function drawName() {
    const np = L.namePanel;
    UI.panel(np, C.white);
    UI.title(DATA.NAME_PROMPT, 480, np.y + 42, '이름은 최대 ' + CFG.NAME_MAX + '글자예요');
    if (nameError) UI.text(nameError, 480, 332, 22, C.alert);
    UI.button({ x: 360, y: 372, w: 240, h: 56 }, '확인', { style: 'primary', onClick: submitName });
    backButton('돌아가기');
  }

  function drawShop() {
    const d = State.data;
    UI.moneyPill(L.moneyPill, won(d.money));
    UI.title(d.shopName, 480, 92, d.playerName + ' 사장님의 인형뽑기 가게');
    const card = { x: 240, y: 156, w: 480, h: 232 };
    UI.panel(card, C.white);
    const rows = [['가게 랭크', DATA.RANK_NAMES[d.rank - 1] || ''], ['소지금', won(d.money)], ['영업 일차', d.day + '일차']];
    rows.forEach((r, i) => {
      const cy = card.y + 44 + i * 70;
      UI.text(r[0], card.x + 36, cy, 22, C.sub, 'left');
      UI.text(r[1], card.x + card.w - 36, cy, 24, C.ink, 'right');
      if (i < rows.length - 1) UI.hline(card.x + 24, cy + 35, card.w - 48);
    });
    UI.text('가게 화면은 다음 단계에서 만들어요', 480, 436, 20, C.sub);
    backButton('타이틀로');
  }

  // 소리 설정 한 줄: [스피커(음소거) 아이콘 버튼] 이름 / 슬라이더 / 퍼센트
  function soundRow(sp, cy, label, key) {
    const snd = Sound.get();
    const muted = snd[key + 'Mute'], vol = snd[key];
    UI.button({ x: sp.x + 30, y: cy - 20, w: 40, h: 40 }, '', {
      style: 'secondary', modal: true, sfx: 'none',
      onClick: () => { if (key === 'bgm') Sound.toggleBgmMute(); else Sound.toggleSfxMute(); },
      draw(x, y, w, h) {
        UI.sprite(muted ? DATA.ICON_SPEAKER.off : DATA.ICON_SPEAKER.on, muted ? C.alert : C.ink, x + (w - 28) / 2, y + (h - 24) / 2, 2);
      },
    });
    UI.text(label, sp.x + 90, cy - 18, 18, muted ? C.sub : C.ink, 'left');
    UI.slider({ x: sp.x + 90, y: cy - 2, w: sp.w - 90 - 100, h: 28 }, vol, {
      modal: true, dim: muted,
      onChange: (v) => { if (key === 'bgm') Sound.setBgm(v); else Sound.setSfx(v); },
      onEnd: () => Sound.sfx('click'),
    });
    UI.text(muted ? '음소거' : Math.round(vol * 100) + '%', sp.x + sp.w - 30, cy + 12, 18, muted ? C.alert : C.ink, 'right');
  }

  function drawModal() {
    UI.scrim(W, H);
    ctx.save();
    ctx.translate(OX, 0);
    if (modal === 'credits') {
      const hp = L.creditsPanel;
      UI.panel(hp, C.white);
      UI.text('크레딧', 480, hp.y + 44, 30, C.ink);
      UI.hline(hp.x + 30, hp.y + 70, hp.w - 60);
      let y = hp.y + 104;
      DATA.CREDITS.forEach((c) => {
        UI.rect(hp.x + 34, y - 4, 8, 8, C.blue);
        UI.text(c.kind, hp.x + 56, y, 18, C.blue, 'left');
        y += 26;
        c.lines.forEach((ln) => {
          UI.wrap(ln, hp.w - 112, 16).forEach((w) => { UI.text(w, hp.x + 56, y, 16, C.ink, 'left'); y += 21; });
        });
        y += 12;
      });
      UI.button({ x: 360, y: hp.y + hp.h - 78, w: 240, h: 52 }, '닫기', { style: 'primary', modal: true, onClick: closeModal });
    } else if (modal === 'help') {
      const hp = L.helpPanel;
      UI.panel(hp, C.white);
      UI.text('게임 설명', 480, hp.y + 44, 30, C.ink);
      UI.hline(hp.x + 30, hp.y + 70, hp.w - 60);
      let y = hp.y + 112;
      DATA.HOWTO.forEach((s) => {
        const lines = UI.wrap(s, hp.w - 96, 20);
        UI.rect(hp.x + 34, y - 4, 8, 8, C.blue);
        lines.forEach((ln, j) => UI.text(ln, hp.x + 60, y + j * 28, 20, C.ink, 'left'));
        y += lines.length * 28 + 22;
      });
      UI.button({ x: 360, y: hp.y + hp.h - 78, w: 240, h: 52 }, '닫기', { style: 'primary', modal: true, onClick: closeModal });
    } else {
      const sp = L.settingsPanel;
      UI.panel(sp, C.white);
      UI.text('설정', 480, sp.y + 40, 30, C.ink);
      UI.hline(sp.x + 30, sp.y + 66, sp.w - 60);
      soundRow(sp, sp.y + 118, '배경음악', 'bgm');
      soundRow(sp, sp.y + 190, '효과음', 'sfx');
      UI.hline(sp.x + 30, sp.y + 226, sp.w - 60);
      if (screen === 'intro') {
        UI.button({ x: 300, y: sp.y + 246, w: 360, h: 52 }, '타이틀로 나가기', { style: 'secondary', modal: true, onClick: () => go('title') });
      } else if (State.hasSave()) {
        UI.button({ x: 300, y: sp.y + 246, w: 360, h: 52 }, confirmWipe ? '정말 지울까요? 한 번 더' : '처음부터 다시', {
          style: confirmWipe ? 'danger' : 'secondary',
          modal: true,
          onClick: () => {
            if (confirmWipe) { State.wipe(); closeModal(); } else confirmWipe = true;
          },
        });
      } else {
        UI.text('저장된 데이터가 없어요', 480, sp.y + 272, 20, C.sub);
      }
      UI.button({ x: 360, y: sp.y + sp.h - 76, w: 240, h: 52 }, '닫기', { style: 'primary', modal: true, onClick: closeModal });
    }
    ctx.restore();
  }

  function draw(ts) {
    now = (ts || 0) / 1000;
    ctx.setTransform(pxk, 0, 0, pxk, 0, 0); // 이후 모든 그림은 논리 좌표(W×576)로 그린다
    ctx.imageSmoothingEnabled = false;
    UI.begin(ctx, cv, modal);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    if (screen === 'title') drawTitle();
    else if (screen === 'intro') drawIntro();
    else {
      ctx.save();
      ctx.translate(OX, 0);
      if (screen === 'name') drawName(); else drawShop();
      ctx.restore();
    }
    if (modal) drawModal();
    UI.end();
    requestAnimationFrame(draw);
  }

  resize();

  // 폰트가 로드된 뒤 시작(실패해도 1.5초 후 시작)
  let started = false;
  function start() { if (started) return; started = true; requestAnimationFrame(draw); }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('20px ' + CFG.FONT, '가나다').then(start, start);
    setTimeout(start, 1500);
  } else {
    start();
  }
})();
