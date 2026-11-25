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
    startBtn: { x: 100, y: 490, w: 240, h: 56 },
    achieveBtn: { x: 356, y: 490, w: 180, h: 56 },
    helpBtn: { x: 552, y: 490, w: 180, h: 56 },
    creditsBtn: { x: 748, y: 490, w: 132, h: 56 },
    achievePanel: { x: 130, y: 48, w: 700, h: 486 },
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
    BASE_VISITORS: 160,                        // 평균 조건(평판 50, 1단계 점포) 하루 방문객
    REP_MULT: [0.6, 1.4],                      // 평판 0 → 0.6배, 100 → 1.4배
    // 아레나 공연: 매주 토·일. 특별 공연: first일차(토요일)부터 every일마다, 한정 인형은 lead일 전부터 발주
    SHOW: { from: 17, to: 22, mult: 1.6, dayMult: 1.12, first: 6, special: { first: 27, every: 28, mult: 2.4, dayMult: 1.35, lead: 7 } },
    STRENGTH: [1.5, 1.25, 1.0, 0.8, 0.6],      // 난이도 1(쉬움)~5(어려움)의 집기 확률 배수
    // 손님 개인차(분류와 무관): 예산 평균·편차, patience 연속 실패 허용, wait 대기 한계(분), skill 숙련, win 성공 후 계속할 확률
    CUSTOMER: { BUDGET_AVG: 7000, BUDGET_SPREAD: 0.45, patience: [4, 8], wait: [6, 12], skill: [0.85, 1.15], win: 0.45 },
    // 취향 일치: appeal [안 맞음, 맞음] 선호 배수. 맞는 인형이 없으면 leave 확률로 돌아가고 남아도 최대 noneMaxPlays판
    MATCH: { appeal: [0.35, 1.0], leave: 0.5, noneMaxPlays: 2, satWin: 0.08 },
    CONV_K: 0.35,                               // 손님이 기계 가격·줄 때문에 돌아가는 기준(작을수록 덜 돌아간다)
    // 영업 중 일이 생긴 뒤 처리까지 걸리는 분. bot = 직접 운영(검증용), staff = 건너뛴 날의 직원, none = 방치
    RESPOND: { bot: 8, staff: 20, none: 9999 },
    TECHNICIAN: { delay: 150, cost: 1.4 },     // 고장을 오래 두면 기사를 부른다
    REFILL_AT: 0.25,                           // 진열이 이 비율 이하가 되면 보충할 일이 생긴다
    LITTER: { chance: 0.07, task: 4, binMult: 2, robotKeep: 0.15, sat: 0.07 }, // 쓰레기를 남길 확률, 이만큼 쌓이면 청소할 일
    EXCHANGE: { chance: 0.04, wait: 25, exchangerKeep: 0.15 },                 // 환전 요청 확률, 기다리는 한계(분), 자동환전기 뒤 남는 비율
    GLOBALPAY_KPOP: 1.25,                      // 해외결제를 두면 K-pop 팬 방문 배수
    STAFF: { rank: 3, wage: 50000 },
    SKIP_NEAR_TOP: 0.95,                       // 1랭크에서 1위 점수의 이 비율을 넘으면 '전국 1위 도전일'(건너뛰기 불가)
    START_REP: 30,
    BREAK_BASE: 0.02, BREAK_AGE: 0.002, BREAK_MAX: 0.15, DURABLE_MULT: 0.35, // 기계 하루 고장 확률 = 기본 + 가동일수 × 계수
    CAPACITY_MULT: 1.5,
    SHOP: [
      { name: '소형 점포 (8평)', slots: 3, rank: 1, rent: 900000, foot: 1.0, cost: 0 },
      { name: '중형 점포 (15평)', slots: 5, rank: 2, rent: 1500000, foot: 1.7, cost: 3000000 },
      { name: '대형 점포 (25평)', slots: 8, rank: 4, rent: 2700000, foot: 2.6, cost: 10000000 },
      { name: '아레나 앞 플래그십 (40평)', slots: 12, rank: 5, rent: 4500000, foot: 3.6, cost: 25000000 },
    ],
    WAREHOUSE: [
      { cap: 150, cost: 0, upkeep: 0 },
      { cap: 300, cost: 800000, upkeep: 1000 },
      { cap: 600, cost: 2000000, upkeep: 2500 },
      { cap: 1200, cost: 5000000, upkeep: 6000 },
    ],
    BULK: [[100, 0.15], [50, 0.10], [20, 0.05]], // [수량 이상, 할인율]
    TREND: { days: 7, appeal: 1.5, price: 1.25, demand: 2.0 }, // 유행 취향: 선호 배수 / 도매가 배수 / 그 취향 손님 가중치
    // 랭크 단계(1=5랭크 ... 5=1랭크). 다음 단계로 오르려면 인기도와 최근 평균 일매출이 모두 필요하다(수익과 인기도로 랭크가 정해진다).
    // 인기도: 하루 변화 = 매출/REVENUE × (0.6+평판) × (0.5+만족도) − 불편 × PENALTY, 어제 인기도의 KEEP만 남는다
    POP: { REVENUE: 20000, KEEP: 0.99, PENALTY: 0.08 },
    // 소품: 같은 것을 또 놓으면 효과가 DUP배씩 줄고, 점포 단계별 CAP을 넘는 매력은 인기도에 더해지지 않는다
    DECOR: { DUP: 0.5, CAP: [1.5, 4, 8, 20], SELL: 0.5 },
    STOCK_SELL: 0.5,                           // 창고 인형 처분: 원가의 비율
    FAST_TASK: 30,                             // 도전과제 '번개 사장': 이 시간(분) 안에 처리
    RANK_POP: [0, 75, 275, 1550, 6500],          // [단계 1 시작, 2에 필요, 3에, 4에, 5(=1랭크)에]
    RANK_REV: [0, 180000, 280000, 530000, 780000], // 최근 평균 일매출(원)
    // 전국 순위표(1랭크 진입 후 표시): 1위 점수, 순위에 따른 감소 지수, 라이벌 수, 시간이 지날수록 라이벌 성장
    NATIONAL: { N: 300, TOP: 16200, EXP: 0.2, GROWTH_DAYS: 300, GROWTH: 0.1 },
  },
  TYPE_SPEED: 32, // 프롤로그 글자 출력 속도(글자/초)
};
