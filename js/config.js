// 모든 튜닝 값은 여기에 모은다.
const CFG = {
  W: 960,
  H: 576,
  SAVE_KEY: 'claw-machine-tycoon-save',
  FONT: 'Game', // assets/fonts/game.woff2 (Galmuri)
  NAME_MAX: 8,
  START_MONEY: 3000000, // 시작 자금(원)
  START_RANK: 1,
  // 흰색 톤 배경 + 푸른 계열 버튼
  COLOR: {
    bg: '#f3f8fc',
    ink: '#14324d',
    white: '#ffffff',
    blue: '#2f80d0',
    blueLight: '#6ab0f0',
    blueDark: '#1f5f9f',
    sky: '#5ba3e0',
    banner: '#1f5f8b',
    gray: '#6b8399',
    line: '#c9d9e6',
    alert: '#d9455f',
    yellow: '#ffd84a',
  },
  // 화면 크기: 높이는 고정, 너비는 창 비율에 맞춰 늘어난다(UI는 가운데 960 영역에 배치)
  DESIGN_W: 960,
  MIN_W: 768,
  MAX_W: 1440,
  // 메인 화면 배치(가운데 960 영역 기준)
  LAYOUT: {
    startBtn: { x: 252, y: 490, w: 240, h: 56 },
    helpBtn: { x: 508, y: 490, w: 200, h: 56 },
  },
  SETTINGS_BTN: { size: 56, margin: 16 }, // 화면 오른쪽 위 모서리 기준
};
