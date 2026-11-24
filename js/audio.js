// 소리: 음원 파일 없이 Web Audio로 직접 합성한다(효과음·배경음악·주변 소리 모두 이 게임을 위해 만든 오리지널).
// 음량·음소거 설정은 게임 저장과 따로 localStorage에 저장한다. 브라우저 정책상 첫 클릭/키 입력(unlock) 뒤부터 소리가 난다.
const Sound = (function () {
  const A = CFG.AUDIO;
  const st = Object.assign({ bgm: A.BGM_DEFAULT, sfx: A.SFX_DEFAULT, bgmMute: false, sfxMute: false }, load());
  let ac = null, master, bgmG, sfxG, noiseBuf;
  let wantBgm = null, curBgm = null, trackG = null, bgmTimer = null, bgmStep = 0, bgmNext = 0;
  let amb = null;

  function load() { try { return JSON.parse(localStorage.getItem(A.SAVE_KEY) || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(A.SAVE_KEY, JSON.stringify(st)); } catch (e) {} }

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    bgmG = ac.createGain(); sfxG = ac.createGain();
    bgmG.connect(master); sfxG.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    return true;
  }
  function apply() {
    if (!ac) return;
    bgmG.gain.setTargetAtTime(st.bgmMute ? 0 : st.bgm * 0.5, ac.currentTime, 0.03);
    sfxG.gain.setTargetAtTime(st.sfxMute ? 0 : st.sfx, ac.currentTime, 0.03);
  }
  // 첫 사용자 입력에서 호출: 오디오를 깨우고, 기다리던 배경음악을 시작한다.
  function unlock() {
    if (!ensure()) return;
    if (ac.state === 'suspended') ac.resume();
    if (wantBgm && curBgm !== wantBgm) startBgm(wantBgm);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  // ---------- 소리 재료 ----------
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(f, t, d, type, v, dest, toF) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (toF) o.frequency.exponentialRampToValueAtTime(toF, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(t, d, v, freq, dest, type, q, toF) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(freq, t);
    if (toF) f.frequency.exponentialRampToValueAtTime(toF, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + d + 0.03);
  }

  // ---------- 효과음 ----------
  const SFX = {
    click: (t, o) => tone(900, t, 0.05, 'square', 0.12, o, 600),
    next: (t, o) => tone(660, t, 0.04, 'square', 0.06, o),
    confirm: (t, o) => { tone(660, t, 0.08, 'square', 0.13, o); tone(990, t + 0.08, 0.12, 'square', 0.13, o); },
    back: (t, o) => tone(520, t, 0.07, 'square', 0.11, o, 330),
    type: (t, o) => tone(1400 + Math.random() * 400, t, 0.02, 'square', 0.035, o),
    pop: (t, o) => tone(500, t, 0.1, 'square', 0.13, o, 1400),
    ding: (t, o) => { tone(1318, t, 0.5, 'sine', 0.17, o); tone(1976, t + 0.02, 0.4, 'sine', 0.09, o); tone(2637, t, 0.25, 'sine', 0.05, o); },
    notif: (t, o) => { tone(1568, t, 0.07, 'square', 0.1, o); tone(2093, t + 0.09, 0.1, 'square', 0.1, o); },
    buzz: (t, o) => { for (let i = 0; i < 9; i++) { tone(130, t + i * 0.09, 0.06, 'sawtooth', 0.1, o); noise(t + i * 0.09, 0.05, 0.08, 400, o); } },
    prize: (t, o) => {
      noise(t, 0.12, 0.35, 400, o); tone(150, t, 0.15, 'sine', 0.28, o, 60);
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + 0.15 + i * 0.07, 0.12, 'square', 0.09, o));
    },
    hammer: (t, o) => { noise(t, 0.05, 0.3, 3000, o, 'bandpass', 2); tone(180, t, 0.08, 'square', 0.16, o, 90); tone(1800, t + 0.01, 0.25, 'sine', 0.04, o); },
    step: (t, o) => noise(t, 0.05, 0.1, 500, o),
    doorbell: (t, o) => { tone(988, t, 0.5, 'sine', 0.15, o); tone(784, t + 0.28, 0.7, 'sine', 0.15, o); },
    sparkle: (t, o) => [1318, 1568, 1976, 2349, 2637].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 'triangle', 0.09, o)),
    whoosh: (t, o) => noise(t, 0.4, 0.18, 300, o, 'bandpass', 1, 2500),
    fanfare: (t, o) => {
      [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.1, 0.25, 'square', 0.1, o));
      [784, 1047, 1319].forEach((f) => tone(f, t + 0.3, 0.6, 'square', 0.08, o));
    },
  };
  function sfx(name) {
    if (!ensure() || !SFX[name]) return;
    if (ac.state === 'suspended') return;
    SFX[name](ac.currentTime + 0.005, sfxG);
  }

  // ---------- 주변 소리(장면 분위기) ----------
  function stopAmbient() {
    if (!amb) return;
    clearTimeout(amb.timer);
    amb.nodes.forEach((n) => { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} });
    amb = null;
  }
  function loopNoise(freq, vol, type, q) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 0.6;
    g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(sfxG);
    s.start();
    return s;
  }
  const PENTA = [72, 74, 76, 79, 81, 84];
  const AMBIENTS = {
    crowd: (a) => { a.nodes.push(loopNoise(700, 0.03)); return () => { tone(260 + Math.random() * 260, ac.currentTime, 0.18, 'sawtooth', 0.01, sfxG); return 350 + Math.random() * 500; }; },
    street: (a) => { a.nodes.push(loopNoise(250, 0.02, 'lowpass')); return () => { if (Math.random() < 0.4) noise(ac.currentTime, 1.4, 0.05, 200, sfxG, 'bandpass', 1, 900); return 1800 + Math.random() * 2000; }; },
    site: () => () => { SFX.hammer(ac.currentTime + 0.005, sfxG); return 700 + Math.random() * 600; },
    arcade: () => () => { tone(mtof(PENTA[Math.floor(Math.random() * PENTA.length)]), ac.currentTime, 0.07, 'square', 0.025, sfxG); return 500 + Math.random() * 900; },
  };
  function ambient(name) {
    if (!ensure()) return;
    stopAmbient();
    if (!name || !AMBIENTS[name]) return;
    const a = { name, nodes: [], timer: null };
    amb = a;
    const tick = AMBIENTS[name](a);
    const loop = () => { if (amb !== a) return; const next = tick(); a.timer = setTimeout(loop, next || 1000); };
    a.timer = setTimeout(loop, 400);
  }

  // ---------- 배경음악: 코드 진행으로 멜로디를 만든 짧은 반복곡 ----------
  function rngMaker(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // prog: [[근음, 'M'|'m'], ...] (마디당 8스텝), mask: 한 마디의 멜로디 자리
  function makeTrack(o) {
    const r = rngMaker(o.seed), lead = [], bass = [];
    o.prog.forEach(([root, q]) => {
      const tones = [0, q === 'm' ? 3 : 4, 7];
      for (let s = 0; s < 8; s++) {
        if (o.mask[s]) lead.push(root + 12 + tones[Math.floor(r() * 3)] + (r() < 0.35 ? 12 : 0) + (r() < 0.12 ? 2 : 0));
        else lead.push(null);
        bass.push(s === 0 ? root - 12 : (s === 4 ? root - 12 + 7 : null));
      }
    });
    return { bpm: o.bpm, lead, bass, len: lead.length, wave: o.wave, vol: o.vol, drums: o.drums };
  }
  const DRUM_FULL = ['k', null, 'h', null, 's', null, 'h', null];
  const DRUM_LIGHT = ['k', null, 'h', null, null, null, 'h', null];
  const TRACKS = {
    title: makeTrack({ bpm: 118, seed: 1, wave: 'square', vol: 0.06, drums: DRUM_FULL, mask: [1, 0, 1, 1, 0, 1, 1, 0], prog: [[60, 'M'], [57, 'm'], [53, 'M'], [55, 'M']] }),
    arcade: makeTrack({ bpm: 140, seed: 2, wave: 'square', vol: 0.055, drums: DRUM_FULL, mask: [1, 1, 0, 1, 1, 0, 1, 1], prog: [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M']] }),
    news: makeTrack({ bpm: 96, seed: 3, wave: 'sawtooth', vol: 0.04, drums: DRUM_LIGHT, mask: [1, 0, 0, 1, 0, 0, 1, 0], prog: [[57, 'm'], [53, 'M'], [50, 'm'], [52, 'M']] }),
    site: makeTrack({ bpm: 90, seed: 4, wave: 'triangle', vol: 0.12, drums: null, mask: [1, 0, 1, 0, 1, 0, 0, 1], prog: [[50, 'm'], [58, 'M'], [53, 'M'], [48, 'M']] }),
    story: makeTrack({ bpm: 104, seed: 5, wave: 'triangle', vol: 0.12, drums: DRUM_LIGHT, mask: [1, 0, 1, 1, 0, 1, 0, 0], prog: [[53, 'M'], [48, 'M'], [50, 'm'], [58, 'M']] }),
    happy: makeTrack({ bpm: 124, seed: 6, wave: 'square', vol: 0.055, drums: DRUM_FULL, mask: [1, 0, 1, 1, 1, 0, 1, 1], prog: [[60, 'M'], [53, 'M'], [55, 'M'], [60, 'M']] }),
    shop: makeTrack({ bpm: 100, seed: 7, wave: 'triangle', vol: 0.12, drums: DRUM_LIGHT, mask: [1, 0, 0, 1, 0, 1, 0, 0], prog: [[60, 'M'], [57, 'm'], [50, 'm'], [55, 'M']] }),
  };

  function playStep(tr, i, t, d) {
    const L = tr.lead[i], B = tr.bass[i];
    if (L != null) tone(mtof(L), t, d * 0.9, tr.wave, tr.vol, trackG);
    if (B != null) tone(mtof(B), t, d * 3.2, 'triangle', 0.15, trackG);
    const dr = tr.drums && tr.drums[i % 8];
    if (dr === 'k') tone(130, t, 0.12, 'sine', 0.22, trackG, 45);
    else if (dr === 'h') noise(t, 0.03, 0.04, 7000, trackG, 'highpass');
    else if (dr === 's') noise(t, 0.08, 0.07, 2500, trackG, 'bandpass');
  }
  function schedule() {
    const tr = TRACKS[curBgm];
    if (!tr || !ac) return;
    const d = 60 / tr.bpm / 2;
    while (bgmNext < ac.currentTime + 0.25) {
      playStep(tr, bgmStep % tr.len, bgmNext, d);
      bgmNext += d; bgmStep++;
    }
  }
  function startBgm(name) {
    if (!ensure()) return;
    const old = trackG;
    if (old) { old.gain.setTargetAtTime(0, ac.currentTime, 0.15); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 900); }
    curBgm = name;
    trackG = ac.createGain();
    trackG.gain.setValueAtTime(0.0001, ac.currentTime);
    trackG.gain.setTargetAtTime(1, ac.currentTime + 0.05, 0.25);
    trackG.connect(bgmG);
    bgmStep = 0; bgmNext = ac.currentTime + 0.08;
    clearInterval(bgmTimer);
    bgmTimer = setInterval(schedule, 50);
  }
  // 틀 곡 이름(title/arcade/news/site/story/happy/shop). 첫 입력 전이면 입력 뒤에 시작한다.
  function bgm(name) {
    wantBgm = name;
    if (!ac) return; // 첫 입력(unlock) 전에는 기억만 해 둔다
    if (curBgm !== name) startBgm(name);
  }

  return {
    unlock, sfx, bgm, ambient,
    get: () => ({ bgm: st.bgm, sfx: st.sfx, bgmMute: st.bgmMute, sfxMute: st.sfxMute }),
    setBgm: (v) => { st.bgm = v; apply(); save(); },
    setSfx: (v) => { st.sfx = v; apply(); save(); },
    toggleBgmMute: () => { st.bgmMute = !st.bgmMute; apply(); save(); },
    toggleSfxMute: () => { st.sfxMute = !st.sfxMute; apply(); save(); },
  };
})();
