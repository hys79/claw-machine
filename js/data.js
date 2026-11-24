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
  //         emote(id, !/bulb), pose(id, front/back), sfx(효과음 이름), shake(세기), ask(태그, 글) = 대사 뒤에 가게 이름 입력, title(큰 글, 작은 글)
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
    { bg: 'street', walkers: 3, actors: [{ id: 'me', x: 100, y: 106 }, { id: 'suit', kind: 'suit', x: 262, y: 106 }], steps: [
      ['wait', 0.4],
      ['say', '{name}', '좋아, 오늘이 개업 첫날이다! 간판도 달았고, 기계도 채웠고…'],
      ['move', 'suit', 156, 32, true],
      ['emote', 'me', '!'], ['wait', 0.5],
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
// 속성 태그(인형): 계열 / 분위기 / 등급·행사. 손님 선호와 유행이 태그로 맞물린다.
DATA.TAGS = ['동물', '음식', '우주', '공룡', '날씨', '귀여움', '코믹', '시크', '희귀', '한정', '공연'];

// 인형: size S/M/L, cost 도매 원가(원), tier normal/rare/limited, hard 0~1(집기 어려움), rank 해금 랭크
DATA.DOLLS = [
  { id: 'chick', name: '꼬마 병아리', size: 'S', cost: 600, tier: 'normal', tags: ['동물', '귀여움'], hard: 0.0, rank: 1 },
  { id: 'rocket', name: '콩알 로켓', size: 'S', cost: 700, tier: 'normal', tags: ['우주', '귀여움'], hard: 0.0, rank: 1 },
  { id: 'breadduck', name: '식빵 오리', size: 'S', cost: 700, tier: 'normal', tags: ['음식', '동물', '코믹'], hard: 0.05, rank: 1 },
  { id: 'cloudy', name: '뭉게 구름이', size: 'S', cost: 800, tier: 'normal', tags: ['날씨', '귀여움'], hard: 0.05, rank: 1 },
  { id: 'roundbear', name: '동글 곰', size: 'M', cost: 2400, tier: 'normal', tags: ['동물', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'berrybunny', name: '딸기 토끼', size: 'M', cost: 2600, tier: 'normal', tags: ['동물', '음식', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'cooldino', name: '선글라스 공룡', size: 'M', cost: 2800, tier: 'normal', tags: ['공룡', '코믹', '시크'], hard: 0.15, rank: 1 },
  { id: 'penguin', name: '펭귄 반장', size: 'M', cost: 2500, tier: 'normal', tags: ['동물', '코믹'], hard: 0.1, rank: 1 },
  { id: 'spacecat', name: '우주냥', size: 'M', cost: 3000, tier: 'normal', tags: ['우주', '동물', '시크'], hard: 0.15, rank: 1 },
  { id: 'bigbear', name: '뭉치 곰', size: 'L', cost: 7500, tier: 'normal', tags: ['동물', '귀여움'], hard: 0.1, rank: 1 },
  { id: 'koala', name: '낮잠 코알라 쿠션', size: 'L', cost: 8500, tier: 'normal', tags: ['동물', '귀여움'], hard: 0.15, rank: 1 },
  { id: 'bigdino', name: '대왕 공룡', size: 'L', cost: 9000, tier: 'normal', tags: ['공룡', '코믹'], hard: 0.2, rank: 1 },
  { id: 'megabear', name: '거대 뭉치 곰', size: 'XL', cost: 28000, tier: 'normal', tags: ['동물', '귀여움'], hard: 0, rank: 1 },
  { id: 'kingdino', name: '초대형 공룡 대왕', size: 'XL', cost: 34000, tier: 'normal', tags: ['공룡', '코믹'], hard: 0, rank: 2 },
  { id: 'jumbocat', name: '점보 우주냥', size: 'XL', cost: 32000, tier: 'normal', tags: ['우주', '동물', '시크'], hard: 0, rank: 2 },
  { id: 'arenajumbo', name: '아레나 응원 점보 곰', size: 'XL', cost: 42000, tier: 'limited', tags: ['공연', '동물', '한정'], hard: 0, rank: 3 },
  { id: 'rainbowsheep', name: '무지개 양', size: 'M', cost: 4200, tier: 'rare', tags: ['동물', '귀여움', '희귀'], hard: 0.3, rank: 2 },
  { id: 'moonrabbit', name: '달토끼 요정', size: 'M', cost: 4500, tier: 'rare', tags: ['우주', '동물', '시크', '희귀'], hard: 0.3, rank: 2 },
  { id: 'cheerbear', name: '응원봉 곰', size: 'L', cost: 11000, tier: 'limited', tags: ['공연', '동물', '한정'], hard: 0.25, rank: 2 },
  { id: 'goldpig', name: '황금 저금 돼지', size: 'M', cost: 6000, tier: 'limited', tags: ['동물', '코믹', '한정'], hard: 0.35, rank: 3 },
];

// 기계(여러 종류). sizes: 넣을 수 있는 인형 크기, slotCost: 크기별 차지하는 칸, grab: 크기별 한 번 집을 때 성공 확률(집게 힘 3단계 기준),
// attempts: 한 판에 집을 수 있는 횟수, playSec: 한 판에 걸리는 시간(초), ref: 손님이 느끼는 기준 가격
DATA.MACHINES = {
  mini: {
    id: 'mini', name: '소형 뽑기 기계', rank: 1, price: 700000, footprint: 1, slots: 24, sizes: ['S', 'M'], slotCost: { S: 1, M: 3 },
    power: 1200, repair: 30000, playSec: 55, attempts: 1, grab: { S: 0.22, M: 0.07 }, priceDef: 500, priceRange: [300, 1000], ref: 500, appeal: 0.9,
    sizeAppeal: { S: 1.0, M: 0.9 },
    desc: '작고 저렴하다. 소형 인형 전용이고, 중형은 겨우 들어가며(칸을 많이 차지하고 잘 안 집힌다), 대형 인형은 들어가지 않는다.',
  },
  standard: {
    id: 'standard', name: '일반 뽑기 기계', rank: 1, price: 1200000, footprint: 1, slots: 36, sizes: ['S', 'M', 'L'], slotCost: { S: 1, M: 2, L: 4 },
    power: 2000, repair: 50000, playSec: 75, attempts: 1, grab: { S: 0.24, M: 0.13, L: 0.05 }, priceDef: 1000, priceRange: [500, 2000], ref: 1000, appeal: 1.0,
    sizeAppeal: { S: 1.0, M: 1.0, L: 0.95 },
    desc: '가장 무난한 기계. 모든 크기의 인형을 넣을 수 있다.',
  },
  big: {
    id: 'big', name: '대형 뽑기 기계', rank: 2, price: 2800000, footprint: 2, slots: 24, sizes: ['S', 'M', 'L'], slotCost: { S: 1, M: 2, L: 3 },
    power: 3500, repair: 120000, playSec: 100, attempts: 1, grab: { S: 0.30, M: 0.17, L: 0.09 }, priceDef: 2000, priceRange: [1000, 4000], ref: 2000, appeal: 1.25,
    sizeAppeal: { S: 0.75, M: 1.0, L: 1.25 },
    desc: '점포 칸을 2개 차지하는 큰 기계. 대형 인형이 가장 잘 어울리고 눈에 띄지만 소형 인형은 휑해 보인다.',
  },
  timer: {
    id: 'timer', name: '타이머 뽑기 기계', rank: 2, kind: 'timer', price: 1800000, footprint: 1, slots: 10, sizes: ['L', 'XL'], slotCost: { L: 3, XL: 5 },
    power: 2500, repair: 80000, playSec: 45, attempts: 1,
    target: 10, tolerance: [0.04, 0.025, 0.012, 0.008, 0.005], sigma: 0.32, // 목표 시간(초), 단계별 허용 오차(±초), 평균 손님의 버튼 오차(표준편차, 초)
    grab: { L: 1, XL: 1 }, priceDef: 2500, priceRange: [1500, 5000], ref: 2500, appeal: 1.35, sizeAppeal: { L: 1.0, XL: 1.7 },
    desc: '정확히 10.00초에 버튼을 눌러야 경품을 주는 기계. 보통 엄청 큰 인형을 넣어 이목을 끈다. 집게 힘 대신 허용 오차로 난이도를 정하고, 고수 손님이 특히 잘 맞춘다.',
  },
};

// 손님 유형. budget 평균 예산(원), patience 연속 실패 허용, wait 줄 서서 기다리는 한계(분), skill 집게 숙련 배수, win 성공 후 계속할 확률,
// tagW/sizeW/machineW 선호 배수, time 시간대 가중
DATA.CUSTOMERS = [
  { id: 'family', name: '가족 손님', weight: 1.0, budget: 6000, patience: 4, wait: 8, skill: 0.95, win: 0.4,
    tagW: { 동물: 1.3, 귀여움: 1.4 }, sizeW: { S: 1.0, M: 1.2, L: 1.0, XL: 1.4 }, machineW: { mini: 1.1, standard: 1.1, big: 1.0, timer: 0.6 },
    time: { hours: [11, 17], mult: 1.7, off: 0.6, weekend: 1.4 } },
  { id: 'couple', name: '연인 손님', weight: 0.9, budget: 8000, patience: 5, wait: 10, skill: 1.0, win: 0.35,
    tagW: { 귀여움: 1.3, 공연: 1.2 }, sizeW: { S: 0.7, M: 1.0, L: 1.6, XL: 1.8 }, machineW: { mini: 0.7, standard: 1.0, big: 1.4, timer: 0.9 },
    time: { hours: [17, 22], mult: 1.7, off: 0.7, weekend: 1.1 } },
  { id: 'student', name: '학생 손님', weight: 1.0, budget: 3500, patience: 3, wait: 6, skill: 1.0, win: 0.3,
    tagW: { 코믹: 1.4, 한정: 1.4, 공룡: 1.2 }, sizeW: { S: 1.2, M: 1.0, L: 0.7 }, machineW: { mini: 1.4, standard: 1.0, big: 0.7, timer: 0.9 },
    time: { hours: [15, 20], mult: 1.7, off: 0.5, weekend: 0.9 } },
  { id: 'master', name: '인형뽑기 고수 손님', weight: 0.35, budget: 12000, patience: 8, wait: 15, skill: 1.35, win: 0.55,
    tagW: { 희귀: 1.8, 한정: 1.6, 시크: 1.2 }, sizeW: { S: 0.8, M: 1.0, L: 1.2 }, machineW: { mini: 0.5, standard: 0.9, big: 1.1, timer: 1.7 },
    time: { hours: [19, 22], mult: 1.6, off: 0.8, weekend: 1.3 } },
  { id: 'tourist', name: '관광객 손님', weight: 0.5, budget: 8000, patience: 4, wait: 8, skill: 0.9, win: 0.4,
    tagW: { 공연: 1.7, 한정: 1.4, 귀여움: 1.1 }, sizeW: { S: 1.0, M: 1.2, L: 1.1, XL: 1.4 }, machineW: { mini: 1.0, standard: 1.0, big: 1.0, timer: 1.0 },
    time: { hours: [10, 22], mult: 1.0, off: 1.0, weekend: 1.3, show: 3.0 } },
  { id: 'browser', name: '구경 손님', weight: 0.8, budget: 2000, patience: 2, wait: 4, skill: 0.9, win: 0.2,
    tagW: {}, sizeW: { S: 1.0, M: 1.0, L: 0.8, XL: 1.3 }, machineW: { mini: 1.2, standard: 1.0, big: 0.9, timer: 0.8 },
    time: { hours: [10, 22], mult: 1.0, off: 1.0, weekend: 1.0 } },
];
