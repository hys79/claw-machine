// 모든 튜닝 값은 여기에 모은다.
const CFG = {
  W: 960,
  H: 576,
  SAVE_KEY: 'claw-machine-tycoon-save',
  FONT: 'Game', // assets/fonts/game.woff2 (Galmuri)
  NAME_MAX: 8,
  SHOP_NAME_MAX: 10, // 가게 이름 최대 글자 수
  TITLE_OUTLINE: 10, // 타이틀·카드 글자 테두리 두께(글자 크기와 무관하게 일정)
  START_MONEY: 3000000, // 시작 자금(원)
  START_RANK: 1,
  // 흰색 톤 배경 + 푸른 계열 포인트. 분홍·보라 등 다른 색이 UI를 지배하지 않게 한다(docs/UI_GUIDE.md).
  COLOR: {
    bg: '#f3f8fc',      // 화면 바탕
    white: '#ffffff',   // 패널·카드 바탕, 어두운 면 위 글자
    ink: '#14324d',     // 글자, 모든 테두리·글자 외곽선
    sub: '#5f7a92',     // 보조 글자, 비활성
    soft: '#e4eff8',    // 부드러운 버튼·칸 바탕
    line: '#c9d9e6',    // 구분선, 버튼 아래 그늘
    edge: '#8fa9be',    // 비활성 버튼 테두리
    blue: '#2f80d0',    // 주 버튼
    blueHi: '#4590e0',  // 주 버튼 마우스 오버
    blueLight: '#6ab0f0',
    blueDark: '#1f5f9f',
    alert: '#d9455f',   // 위험·경고(초기화 확인)
    alertHi: '#e8647a',
    alertLight: '#ef7a8f',
    alertDark: '#a52c43',
    yellow: '#ffd84a',  // 돈·강조(타이틀 둘째 줄, 코인)
    scrim: 'rgba(10,30,50,0.62)',        // 팝업 뒤 어두운 막
    shadow: 'rgba(10,30,50,0.35)',       // 딱딱한 오프셋 그림자
  },
  // 테두리 두께: 가장 바깥 창(panel)만 굵게, 나머지는 얇게
  BW: { button: 2, panel: 5, dialog: 3, small: 2 },
  // 화면 크기: 높이는 고정, 너비는 창 비율에 맞춰 늘어난다(UI는 가운데 960 영역에 배치)
  DESIGN_W: 960,
  MIN_W: 768,
  MAX_W: 1440,
  // 화면 배치(가운데 960 영역 기준)
  LAYOUT: {
    startBtn: { x: 164, y: 490, w: 240, h: 56 },
    helpBtn: { x: 420, y: 490, w: 200, h: 56 },
    creditsBtn: { x: 636, y: 490, w: 160, h: 56 },
    backBtn: { x: 16, y: 520, w: 150, h: 44 },    // 서브 화면 왼쪽 아래(공통)
    moneyPill: { x: 16, y: 14, w: 190, h: 32 },   // 왼쪽 위 소지금 알약(공통)
    skipBtn: { x: 804, y: 16, w: 140, h: 44 },    // 프롤로그 건너뛰기
    dialog: { x: 40, y: 396, w: 880, h: 156 },    // 대사창
    cutDialog: { x: 40, y: 436, w: 880, h: 118 }, // 컷신 대사창(그림을 덜 가리게 낮고 납작하게)
    namePanel: { x: 200, y: 84, w: 560, h: 372 }, // 가게 신청서(이름 입력)
    helpPanel: { x: 160, y: 88, w: 640, h: 420 },
    creditsPanel: { x: 160, y: 60, w: 640, h: 470 },
    settingsPanel: { x: 240, y: 70, w: 480, h: 440 },
  },
  SETTINGS_BTN: { size: 40, margin: 14 }, // 화면 오른쪽 위 모서리 기준
  // 소리 기본값(0~1)과 저장 위치(게임 저장과 별개)
  AUDIO: { SAVE_KEY: 'claw-machine-audio', BGM_FILE: 'assets/audio/background.mp3', BGM_GAIN: 0.8, BGM_DEFAULT: 0.3, SFX_DEFAULT: 0.8 },
  TYPE_SPEED: 32, // 프롤로그 글자 출력 속도(글자/초)
};
