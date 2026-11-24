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
  // 메인 화면 배치(배경 그림 위에 겹쳐 놓는 요소)
  LAYOUT: {
    startBtn: { x: 180, y: 480, w: 290, h: 72 },
    helpBtn: { x: 490, y: 480, w: 290, h: 72 },
    settingsBtn: { x: 852, y: 28, w: 80, h: 80 },
  },
};
