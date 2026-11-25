// 게임 데이터(문구, 스프라이트 등)를 여기에 모은다.
const DATA = {
  // 타이틀: [글, 크기, 색] 조각을 한 줄로 잇는다(강조할 부분만 크게).
  TITLE_ROWS: [
    [['인형뽑기', 44, 'white'], [' 고수인 내가', 28, 'white']],
    [['최고 랭크 사장이', 64, 'yellow'], [' 되어보려고 합니다', 28, 'white']],
  ],
  // 가게 랭크는 5랭크(막 연 가게)에서 시작해 1랭크까지 오른다. 인덱스 0 = 5랭크 ... 4 = 1랭크(전국 순위가 표시된다).
  RANK_NAMES: ['5랭크 · 동네 가게', '4랭크 · 상권 대표', '3랭크 · 도시 명소', '2랭크 · 지역 강자', '1랭크 · 전국구'],

  // 프롤로그 컷신 대본(대사 위주). {name}=플레이어 이름, {shop}=가게 이름, {이:shop}처럼 쓰면 그 이름의 받침에 맞는 조사(이/가, 은/는, 을/를)만 붙는다.
  // bg: arcade(오락실 안) | phone(핸드폰 뉴스) | site(공사 중인 아레나) | arena(완공된 아레나) | street(우리 가게가 있는 거리), light: 화면 색 입힘, crowd: 광장 구경꾼 수, walkers: 거리 행인 수
  // actors: 등장 인물(x, y는 발 위치, 도트 좌표 0~240, size:'mini'는 멀리서 본 작은 모습). 단계: say(태그, 글), wait(초), move(id, x, 속도, true=끝날 때까지 대기),
  //         emote(id, !/bulb), pose(id, front/back/sideR/sideL), sfx(효과음 이름), shake(세기), ask(태그, 글) = 대사 뒤에 가게 이름 입력, title(큰 글, 작은 글)
  STORY: [
    { bg: 'arcade', actors: [{ id: 'me', x: 133, y: 106, pose: 'back' }], steps: [
      ['wait', 0.5],
      ['say', '{name}', '좋았어… 조금만 더. 오른쪽, 오른쪽!'],
      ['shake', 3], ['sfx', 'prize'], ['emote', 'me', '!'], ['wait', 0.9],
      ['say', '{name}', '잡았다! 역시 나라니까~'],
      ['say', '{name}', '이 정도면 인형뽑기 고수라고 불러도 되겠지?'],
      ['shake', 2], ['sfx', 'buzz'], ['pose', 'me', 'front'], ['emote', 'me', '!'], ['wait', 0.7],
      ['say', '{name}', '응? 핸드폰 알림이네. 무슨 뉴스지?'],
    ] },
    { bg: 'phone', actors: [], steps: [
      ['sfx', 'notif'], ['wait', 0.5],
      ['say', '뉴스 앵커', "속보입니다. 서울 창동에 대형 공연장 '창동 아레나'가 새롭게 들어선다는 소식입니다."],
      ['say', '뉴스 앵커', '공연이 열리는 날이면 국내외 관객이 수만 명씩 몰릴 것으로 예상됩니다.'],
      ['say', '뉴스 앵커', '공연장 주변에는 새로운 상권도 함께 조성될 전망입니다.'],
      ['say', '{name}', '수만 명에… 외국인 관광객까지 온다고?'],
    ] },
    { bg: 'site', actors: [{ id: 'me', x: 20, y: 106, size: 'mini' }], steps: [
      ['move', 'me', 92, 34, true],
      ['say', '{name}', '여기가 그 공사 현장이구나. 진짜 엄청 크네…'],
      ['say', '{name}', '이런 곳 바로 옆에서 인형뽑기 가게를 하면…'],
      ['emote', 'me', 'bulb'], ['wait', 1.0],
      ['say', '{name}', '사람들이 줄을 서겠는데?!'],
    ] },
    { bg: 'arena', light: 'dusk', crowd: 40, actors: [{ id: 'me', x: 118, y: 106, size: 'mini' }], steps: [
      ['say', '{name}', '공연이 끝나고 사람들이 우르르 쏟아져 나오면…'],
      ['say', '{name}', '다들 기념으로 인형 하나쯤은 뽑아 가겠지!'],
      ['say', '{name}', '좋아, 결정했어. 내가 직접 인형뽑기 가게를 차려 보는 거야!'],
    ] },
    { bg: 'street', walkers: 4, actors: [{ id: 'me', x: 104, y: 106 }], steps: [
      ['sfx', 'doorbell'],
      ['say', '{name}', '가게 자리는 여기로 하고… 이제 간판이 문제네.'],
      ['ask', '{name}', '인형뽑기 가게 이름은 뭘로 짓지…?'],
      ['emote', 'me', 'bulb'],
      ['say', '{name}', '그래! “{shop}”{이:shop} 좋겠어!'],
      ['say', '{name}', '좋아, 오늘부터 여기가 내 가게다!'],
      ['title', '{shop}', '창동 아레나 옆, 작은 인형뽑기 가게'],
    ] },
    // 개업 첫날: 클럽 회장이 나타나 랭크를 알려 준다(영업 화면이 생기면 "1일차 영업 시작" 때로 옮긴다)
    { bg: 'street', walkers: 3, actors: [{ id: 'me', x: 100, y: 106 }, { id: 'suit', kind: 'suit', x: 420, y: 106 }], steps: [
      ['wait', 0.4],
      ['say', '{name}', '좋아, 오늘이 개업 첫날이다! 간판도 달았고, 기계도 채웠고…'],
      ['move', 'suit', 126, 32, true],
      ['pose', 'me', 'sideR'], ['emote', 'me', '!'], ['wait', 0.5],
      ['say', '???', '허허, 거기 젊은 사장님. 잠깐 시간 괜찮으신가?'],
      ['say', '{name}', '(…양복 색깔이 왜 저러지?) 네? 저, 저요?'],
      ['say', '???', '실례했네. 나는 인형뽑기 애호가 클럽 회장이라고 하네.'],
      ['say', '클럽 회장', '자네, 이 바닥에 "랭크"라는 게 있다는 건 알고 있나?'],
      ['say', '{name}', '랭크요? 처음 듣는데요.'],
      ['say', '클럽 회장', '전국의 인형뽑기 가게는 5랭크부터 1랭크까지 나뉘어 있지. 막 문을 연 가게는 모두 5랭크에서 시작한다네.'],
      ['say', '클럽 회장', '랭크는 가게의 수익과 인기도로 정해지고, 1랭크에 오르면 그때부터 전국 순위가 매겨지지.'],
      ['say', '{name}', '전국… 순위요?'],
      ['say', '클럽 회장', '그렇다네. 그 꼭대기가 전국 1등이지. 자네 같은 신참이 오를 거라곤 아무도 생각 않겠지만… 허허.'],
      ['emote', 'me', 'bulb'], ['wait', 0.9],
      ['say', '{name}', '…재밌네요. 인형뽑기라면 자신 있으니까.'],
      ['say', '{name}', '좋아요, 까짓거! 전국 1등, 한번 노려보겠습니다!'],
      ['say', '클럽 회장', '허허허, 기대하고 있겠네. 개업 축하하네, {name} 사장.'],
      ['move', 'suit', 420, 34],
      ['say', '{name}', '…이상한 아저씨네. 그래도 목표가 생겼어. 자, 가게 문 열자!'],
      ['title', '목표: 전국 1등', '5랭크에서 시작하는 인형뽑기 사장의 도전'],
    ] },
  ],
  // 대사 이름표 색(대본의 이름 그대로): 그 인물의 옷 색과 비슷하게. 없으면 기본 파랑
  SPEAKER_COLORS: { '{name}': '#3f8fe0', '???': '#1f8f87', '클럽 회장': '#1f8f87', '뉴스 앵커': '#c0392b' },
  NAME_PROMPT: '당신의 이름은?',

  HOWTO: [
    '인형뽑기 고수인 주인공이 아레나 상권에 가게를 차려요.',
    '번 돈으로 기계, 인형, 시설을 업그레이드해요.',
    '가게 랭크를 5랭크에서 1랭크까지 올려 전국 1등에 도전해요.',
    '돈이 다 떨어지면 폐업! 신중하게 운영하세요.',
  ],
  // 크레딧 화면 목록: 종류와 설명 줄. 새 폰트·음원·그림을 쓰면 여기와 assets/CREDITS.md에 함께 적는다.
  CREDITS: [
    { kind: '폰트', lines: ['Galmuri - SIL Open Font License 1.1', 'github.com/quiple/galmuri'] },
    { kind: '배경음악', lines: ['Sharou - しゅわしゅわハニーレモン350ml'] },
    { kind: '효과음', lines: ['Original made (Web Audio)'] },
    { kind: '그림·캐릭터', lines: ['Original made'] },
  ],

  // 도트 스프라이트. 팔레트 글자 → 색
  PALETTE: { k: '#14324d', r: '#ff77a8', w: '#fff1e8', g: '#8fd3ff', y: '#ffd84a', p: '#ff9fc2', a: '#ffffff', b: '#b9d6ee' },
  CLAW_MACHINE: [
    '..kkkkkkkkkkkk..',
    '.krrrrrrrrrrrrk.',
    '.kwwwwwwwwwwwwk.',
    '.kkkkkkkkkkkkkk.',
    '.kgggggkkgggggk.',
    '.kgggggkkgggggk.',
    '.kggggkyykggggk.',
    '.kgggkk..kkgggk.',
    '.kggggggggggggk.',
    '.kgpppggggppggk.',
    '.kppppgggpppppk.',
    '.kppkpgggppkppk.',
    '.kpppppgpppppgk.',
    '.kkkkkkkkkkkkkk.',
    '.krrrrrrrrrrrrk.',
    '.kryykkkkkrrrrk.',
    '.krrrrrrrrrrrrk.',
    '.kkkkkkkkkkkkkk.',
    '..kk........kk..',
    '..kk........kk..',
  ],
  // 메인 화면 도트 풍경 색(js/scene.js에서 사용)
  SCENE_PAL: {
    skyTop: '#62b9ee', skyBottom: '#fbe6cc', sunGlow: '#fff3b8', sunCore: '#fffbe6',
    cloud: '#ffffff', cloudShade: '#d6e6f4',
    mtnBack: '#a6c0d8', mtnFront: '#8cadc9',
    aptA: '#b7c8d9', aptB: '#a8bccf', aptC: '#c4d2e0', aptWin: '#e8f1f8', aptWarm: '#ffe2a0',
    lawnA: '#8ad67e', lawnB: '#74c46c', lawnC: '#5eac5b', lawnLight: '#a3e293', lawnDark: '#4c9650',
    river: '#8fd2f2', riverEdge: '#68b3de',
    path: '#f1e5c9', pathEdge: '#d8c7a0', pathLight: '#fbf3df',
    rim: '#dfe6ee', rimLight: '#f2f6fa', roof: '#78c47a', roofDark: '#5aa862', oculus: '#3a62c8', oculusHi: '#7099ea',
    glassA: '#9fd6e8', glassB: '#6ab6d6', glassEdge: '#3f7fa8', glassWarm: '#d9a9d6', ledge: '#3f6c8f', outline: '#2d4a66',
    skirtTop: '#dbe3eb', skirtMid: '#c3cdd8', skirtDark: '#98a7b8',
    door: '#ffe9a0', doorFrame: '#2d4a66',
    terraceEdge: '#8d9db0', terraceA: '#e6ecf2', terraceB: '#cdd7e2',
    concrete: '#eef2f6', concreteLight: '#ffffff', concreteShade: '#c9d3de', concreteDark: '#9eadbf',
    glassLight: '#bfe8f7', glassMid: '#8fcfe8', glassDeep: '#63aed2', glassShade: '#3b7ea6',
    roofLight: '#9fe09a', skylight: '#4f86e0', skylightEdge: '#2f5db3', skylightHi: '#9cc4f6',
    annex: '#e1e8ef', annexRoof: '#aab7c6', led1: '#7a5de0', led2: '#e06ad0',
    dome: '#cfe8f8', domeHi: '#ffffff',
    treeDark: '#2d7a47', tree: '#3f9a55', treeLight: '#6cc070', trunk: '#7a5230',
    bird: '#2d4a66',
  },
};

// 설정 톱니바퀴(15x15, 좌우·상하 대칭). 'a' 흰색, 'b' 오른쪽 아래 그늘색
DATA.GEAR = (function () {
  const c = 7, rows = [];
  for (let y = 0; y < 15; y++) {
    let row = '';
    for (let x = 0; x < 15; x++) {
      const dx = x - c, dy = y - c, ax = Math.abs(dx), ay = Math.abs(dy);
      const d = Math.sqrt(dx * dx + dy * dy);
      let on = d <= 5.2;                                  // 몸통
      if (ax <= 1 && ay >= 5) on = true;                  // 위·아래 톱니
      if (ay <= 1 && ax >= 5) on = true;                  // 좌·우 톱니
      if (ax >= 4 && ax <= 5 && ay >= 4 && ay <= 5) on = true; // 대각선 톱니(2x2)
      if (d <= 2.5) on = false;                           // 가운데 구멍
      row += on ? (dx + dy >= 5 ? 'b' : 'a') : '.';
    }
    rows.push(row);
  }
  return rows;
})();

// 스피커 아이콘(14x12, 'k' 한 색). 켜짐: 소리 물결 두 줄 / 음소거: X 표시
DATA.ICON_SPEAKER = (function () {
  const make = (muted) => {
    const rows = [];
    for (let y = 0; y < 12; y++) {
      let row = '';
      for (let x = 0; x < 14; x++) {
        const dy = y - 5.5;
        let on = false;
        if (x <= 2 && y >= 4 && y <= 7) on = true;                                   // 본체
        if (x >= 3 && x <= 5 && Math.abs(dy) <= 2 + (x - 3) * 1.5) on = true;        // 나팔
        if (!muted) {
          const d = Math.hypot(x - 5, dy);
          if (x >= 8 && ((d >= 4.1 && d <= 5.1) || (d >= 7.0 && d <= 8.0))) on = true; // 물결 두 줄
        } else {
          const ux = x - 10.5;
          if (Math.abs(ux) <= 3 && Math.abs(Math.abs(dy) - Math.abs(ux)) <= 0.55) on = true; // X
        }
        row += on ? 'k' : '.';
      }
      rows.push(row);
    }
    return rows;
  };
  return { on: make(false), off: make(true) };
})();

// ===== 시뮬레이션 데이터(초안) =====
// 인형 태그는 크기(size)와 취향(taste) 두 가지. 손님도 같은 취향을 가진다.
DATA.TASTES = ['동물', '귀여움', '음식', '코믹', '우주', '레트로', '희귀', '아이돌'];

// 인형: size S/M/L/XL, cost 도매 원가(원), taste 취향 태그, hard 0~1(집기 어려움),
// rank 해금 단계(1=5랭크 … 5=1랭크), special: 특별 공연 한정(공연 전 일주일 동안만 발주). 아이돌 인형은 전부 가상 그룹이다.
DATA.DOLLS = [
  { id: 'chick', name: '꼬마 병아리', size: 'S', cost: 600, taste: ['동물', '귀여움'], hard: 0.0, rank: 1 },
  { id: 'rocket', name: '콩알 로켓', size: 'S', cost: 700, taste: ['우주', '귀여움'], hard: 0.0, rank: 1 },
  { id: 'breadduck', name: '식빵 오리', size: 'S', cost: 700, taste: ['음식', '코믹'], hard: 0.05, rank: 1 },
  { id: 'oldrobot', name: '태엽 로봇', size: 'S', cost: 900, taste: ['레트로', '우주'], hard: 0.1, rank: 1 },
  { id: 'lumikey', name: '루미나 미니 응원인형', size: 'S', cost: 1100, taste: ['아이돌', '귀여움'], hard: 0.05, rank: 2 },
  { id: 'roundbear', name: '동글 곰', size: 'M', cost: 2400, taste: ['동물', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'berrybunny', name: '딸기 토끼', size: 'M', cost: 2600, taste: ['음식', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'penguin', name: '펭귄 반장', size: 'M', cost: 2500, taste: ['동물', '코믹'], hard: 0.1, rank: 1 },
  { id: 'spacecat', name: '우주냥', size: 'M', cost: 3000, taste: ['우주', '동물'], hard: 0.15, rank: 1 },
  { id: 'retrofrog', name: '옛날 개구리', size: 'M', cost: 3200, taste: ['레트로', '코믹'], hard: 0.15, rank: 1 },
  { id: 'rainbowsheep', name: '무지개 양', size: 'M', cost: 4200, taste: ['희귀', '귀여움'], hard: 0.3, rank: 2 },
  { id: 'moonrabbit', name: '달토끼 요정', size: 'M', cost: 4500, taste: ['희귀', '우주'], hard: 0.3, rank: 2 },
  { id: 'goldpig', name: '황금 저금 돼지', size: 'M', cost: 5500, taste: ['희귀', '레트로'], hard: 0.3, rank: 3 },
  { id: 'lumidol', name: '루미나 멤버 인형', size: 'M', cost: 3800, taste: ['아이돌', '귀여움'], hard: 0.15, rank: 2 },
  { id: 'bigbear', name: '뭉치 곰', size: 'L', cost: 7500, taste: ['동물', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'bigburger', name: '왕 햄버거 쿠션', size: 'L', cost: 8000, taste: ['음식', '코믹'], hard: 0.15, rank: 1 },
  { id: 'cheerbear', name: '루미나 응원봉 곰', size: 'L', cost: 10000, taste: ['아이돌', '동물'], hard: 0.2, rank: 2 },
  { id: 'classicbear', name: '빈티지 태엽 곰', size: 'L', cost: 11000, taste: ['레트로', '희귀'], hard: 0.25, rank: 3 },
  { id: 'stagebear', name: '특별 무대 응원 곰', size: 'M', cost: 4800, taste: ['아이돌', '희귀'], hard: 0.2, rank: 2, special: true },
  { id: 'megabear', name: '거대 뭉치 곰', size: 'XL', cost: 28000, taste: ['동물', '귀여움'], hard: 0, rank: 3 },
  { id: 'jumborobot', name: '초대형 태엽 로봇', size: 'XL', cost: 34000, taste: ['레트로', '희귀'], hard: 0, rank: 3 },
  { id: 'jumboidol', name: '루미나 점보 마스코트', size: 'XL', cost: 36000, taste: ['아이돌', '귀여움'], hard: 0, rank: 3 },
];

// 기계. sizes: 넣을 수 있는 인형 크기, slots/slotCost: 진열 칸, grab: 크기별 집기 성공 확률(난이도 3 기준),
// playSec: 한 판 시간(초), ref: 손님이 느끼는 기준 가격, rank: 해금 단계(3 = 3랭크)
DATA.MACHINES = {
  mini: {
    id: 'mini', name: '소형 뽑기 기계', rank: 1, price: 700000, footprint: 1, slots: 24, sizes: ['S', 'M'], slotCost: { S: 1, M: 3 },
    power: 1200, repair: 30000, playSec: 55, grab: { S: 0.22, M: 0.07 }, priceDef: 500, priceRange: [300, 1000], ref: 500, appeal: 0.9,
    sizeAppeal: { S: 1.0, M: 0.9 },
    desc: '작고 저렴하다. 소형 인형에 알맞고, 중형은 겨우 들어가며(칸을 많이 차지하고 잘 안 집힌다), 대형 인형은 들어가지 않는다.',
  },
  standard: {
    id: 'standard', name: '일반 뽑기 기계', rank: 1, price: 1200000, footprint: 1, slots: 36, sizes: ['S', 'M', 'L'], slotCost: { S: 1, M: 2, L: 4 },
    power: 2000, repair: 50000, playSec: 75, grab: { S: 0.26, M: 0.13, L: 0.045 }, priceDef: 1000, priceRange: [500, 2000], ref: 1000, appeal: 1.0,
    sizeAppeal: { S: 1.0, M: 1.0, L: 0.95 },
    desc: '가장 무난한 기계. 소형·중형·대형 인형을 넣을 수 있다.',
  },
  big: {
    id: 'big', name: '대형 뽑기 기계', rank: 3, price: 2800000, footprint: 2, slots: 24, sizes: ['S', 'M', 'L'], slotCost: { S: 1, M: 2, L: 3 },
    power: 3500, repair: 120000, playSec: 100, grab: { S: 0.30, M: 0.20, L: 0.085 }, priceDef: 2000, priceRange: [1000, 4000], ref: 2000, appeal: 1.25,
    sizeAppeal: { S: 0.75, M: 1.0, L: 1.25 },
    desc: '점포 칸을 2개 차지하는 큰 기계. 대형 인형이 가장 잘 어울리고 눈에 띄지만 소형 인형은 휑해 보인다.',
  },
  timer: {
    id: 'timer', name: '타이머 뽑기 기계', rank: 3, kind: 'timer', price: 1800000, footprint: 1, slots: 1, sizes: ['XL'], slotCost: { XL: 1 },
    power: 2500, repair: 80000, playSec: 45,
    target: 10, tolerance: [0.03, 0.02, 0.012, 0.008, 0.005], sigma: 0.32, // 목표 시간(초), 난이도 1~5의 허용 오차(±초), 평균 손님의 버튼 오차(표준편차, 초)
    priceDef: 2500, priceRange: [1500, 5000], ref: 2500, appeal: 1.35, sizeAppeal: { XL: 1.4 },
    desc: '정확히 10.00초에 버튼을 눌러야 경품을 주는 기계. 초대형 인형 하나를 넣어 이목을 끈다. 난이도는 허용 오차로 정한다.',
  },
};

// 손님 분류: 분류마다 다른 것은 선호 취향(tastes: 뽑힐 가중치)과 출몰 시간뿐이다. rank: 등장하는 단계.
DATA.CUSTOMERS = [
  { id: 'normal', name: '일반', rank: 1, weight: 1.0, tastes: { 동물: 3, 귀여움: 3, 음식: 2, 코믹: 2, 우주: 1.5, 레트로: 0.3, 희귀: 0.3, 아이돌: 0.4 },
    time: { hours: [12, 20], mult: 1.3, off: 0.8, weekend: 1.3, show: 1.0 } },
  { id: 'mania', name: '마니아', rank: 1, weight: 0.3, tastes: { 희귀: 3, 레트로: 3, 우주: 0.6, 동물: 0.4 },
    time: { hours: [19, 22], mult: 2.2, off: 0.5, weekend: 1.2, show: 0.8 } },
  { id: 'kpop', name: 'K-pop 팬', rank: 2, weight: 0.3, tastes: { 아이돌: 5, 귀여움: 1.5, 희귀: 0.6 },
    time: { hours: [13, 19], mult: 1.8, off: 0.6, weekend: 1.2, show: 3.0 } },
];

// 설비(한 번 사면 영업 중 일이 덜 생긴다). rank: 해금 단계, perMachine: 기계 하나에 다는 개조
DATA.EQUIPMENT = {
  bin: { name: '대형 쓰레기통', rank: 1, price: 150000, desc: '청소할 일이 절반으로 준다.' },
  exchanger: { name: '자동환전기', rank: 2, price: 600000, desc: '환전 요청이 크게 준다.' },
  globalpay: { name: '해외결제 시스템', rank: 3, price: 500000, desc: 'K-pop 팬의 환전 요청이 없어지고, K-pop 팬이 더 온다.' },
  robot: { name: '로봇 청소기', rank: 4, price: 1200000, desc: '청소할 일이 대부분 없어진다.' },
  capacity: { name: '대용량 진열 개조', rank: 4, price: 300000, perMachine: true, desc: '진열 칸이 1.5배(타이머 기계 제외).' },
  durable: { name: '내구성 개조', rank: 4, price: 250000, perMachine: true, desc: '고장이 크게 준다.' },
};
