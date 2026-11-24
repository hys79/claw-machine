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
  // 시뮬레이션 수치(초안: 밸런스 단계에서 조정). 시뮬레이션 코어(js/sim.js)가 읽는다.
  SIM: {
    OPEN: 10, CLOSE: 22,                       // 영업 시간(시). 틱 1 = 가상 1분
    HOUR_W: [0.5, 0.6, 0.9, 1.1, 0.9, 0.8, 0.9, 1.2, 1.6, 1.8, 1.4, 0.9], // 10시~21시 시간대별 유동 가중치
    DOW: [0.85, 0.8, 0.85, 0.9, 1.15, 1.4, 1.35],                          // 월~일 (1일차 = 월요일)
    WEATHER: [['sunny', 0.5, 1.0], ['cloudy', 0.28, 0.95], ['rain', 0.17, 0.7], ['snow', 0.05, 0.6]], // [이름, 확률, 방문객 배수]
    BASE_VISITORS: 125,                        // 평균 조건(평판 50, 1단계 점포) 하루 방문객
    REP_MULT: [0.6, 1.4],                      // 평판 0 → 0.6배, 100 → 1.4배
    SHOW: { from: 17, to: 22, mult: 2.0, first: 8 }, // 공연일(첫 공연 8일차부터 매주 토요일): 17~22시 방문객 배수
    CONV_K: 0.9,                               // 손님이 마음에 드는 인형을 못 찾으면 돌아가는 기준
    STRENGTH: [0.6, 0.8, 1.0, 1.25, 1.5],      // 집게 힘 1~5단계 배수
    RESPOND: { delay: 25, cost: 1.0 },         // 고장: 사장이 바로 대응
    AUTO: { delay: 120, cost: 1.4 },           // 고장: 방치(기사 호출)
    REFILL_DELAY: 20,                          // 인형이 떨어지고 보충까지 걸리는 분
    START_REP: 30,
    BREAK_BASE: 0.02, BREAK_AGE: 0.003, BREAK_MAX: 0.2, // 기계 하루 고장 확률 = 기본 + 가동일수 × 계수
    SHOP: [
      { name: '소형 점포 (8평)', slots: 3, rent: 900000, foot: 1.0, cost: 0 },
      { name: '중형 점포 (15평)', slots: 5, rent: 1700000, foot: 1.35, cost: 9000000 },
      { name: '대형 점포 (25평)', slots: 8, rent: 3000000, foot: 1.8, cost: 28000000 },
      { name: '아레나 앞 플래그십 (40평)', slots: 12, rent: 5500000, foot: 2.6, cost: 80000000 },
    ],
    WAREHOUSE: [
      { cap: 150, cost: 0, upkeep: 0 },
      { cap: 300, cost: 1500000, upkeep: 1000 },
      { cap: 600, cost: 4000000, upkeep: 2500 },
      { cap: 1200, cost: 10000000, upkeep: 6000 },
    ],
    BULK: [[100, 0.15], [50, 0.10], [20, 0.05]], // [수량 이상, 할인율]
    TREND: { days: 7, appeal: 1.5, price: 1.25 }, // 유행 태그: 손님 선호 배수 / 도매가 배수
    RANK_POP: [0, 150, 350, 700, 1400],           // 가게 랭크 1~5에 필요한 인기도
  },
  TYPE_SPEED: 32, // 프롤로그 글자 출력 속도(글자/초)
};
