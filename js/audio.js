// 소리: 효과음과 분위기 소리는 Web Audio로 직접 합성하고, 배경음악은 assets/audio/background.mp3 한 곡을 반복 재생한다(출처: 크레딧 화면 / assets/CREDITS.md).
// 음량·음소거 설정은 게임 저장과 따로 localStorage에 저장한다. 브라우저 정책상 첫 클릭/키 입력(unlock) 뒤부터 소리가 난다.
const Sound = (function () {
  const A = CFG.AUDIO;
  const st = Object.assign({ bgm: A.BGM_DEFAULT, sfx: A.SFX_DEFAULT, bgmMute: false, sfxMute: false }, load());
  let ac = null, master, sfxG, noiseBuf;
  let music = null; // 배경음악(HTMLAudioElement)
  let amb = null;

  function load() { try { return JSON.parse(localStorage.getItem(A.SAVE_KEY) || '{}'); } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(A.SAVE_KEY, JSON.stringify(st)); } catch (e) {} }

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxG = ac.createGain();
    sfxG.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    return true;
  }
  function apply() {
    if (music) music.volume = st.bgmMute ? 0 : Math.min(1, st.bgm * A.BGM_GAIN);
    if (ac) sfxG.gain.setTargetAtTime(st.sfxMute ? 0 : st.sfx, ac.currentTime, 0.03);
  }
  // 배경음악: 한 곡을 계속 반복한다(화면·장면이 바뀌어도 끊기지 않는다).
  function startMusic() {
    if (!music) {
      music = new Audio(A.BGM_FILE);
      music.loop = true;
      music.preload = 'auto';
      apply();
    }
    if (music.paused) { const p = music.play(); if (p && p.catch) p.catch(() => {}); }
  }
  // 첫 사용자 입력에서 호출: 오디오를 깨우고 배경음악을 시작한다.
  function unlock() {
    if (ensure() && ac.state === 'suspended') ac.resume();
    startMusic();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (ac) ac.suspend(); if (music) music.pause(); }
    else { if (ac) ac.resume(); if (music && unlocked()) startMusic(); }
  });
  const unlocked = () => !!music; // 한 번이라도 시작했으면 true

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

  return {
    unlock, sfx, ambient,
    get: () => ({ bgm: st.bgm, sfx: st.sfx, bgmMute: st.bgmMute, sfxMute: st.sfxMute }),
    setBgm: (v) => { st.bgm = v; apply(); save(); },
    setSfx: (v) => { st.sfx = v; apply(); save(); },
    toggleBgmMute: () => { st.bgmMute = !st.bgmMute; apply(); save(); },
    toggleSfxMute: () => { st.sfxMute = !st.sfxMute; apply(); save(); },
  };
})();
