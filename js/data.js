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
// 인형 태그는 크기(size)와 취향(taste) 두 가지. 인형도 손님도 취향은 하나씩이다.
// 인형 이름과 그림은 임시(placeholder)이며 후반 작업에서 한 번에 다듬는다.
DATA.TASTES = ['동물', '음식', '코믹', '희귀', '아이돌'];
// 취향 아이콘(7×7 도트, k 한 색). 영업 화면의 기계 위 표시에 쓴다.
DATA.TASTE_ICON = {
  동물: ['.......', '.k.k.k.', '.k.k.k.', '.......', '..kkk..', '.kkkkk.', '.kk.kk.'],       // 발바닥
  음식: ['....kk.', '...kkkk', '..kkkkk', '..kkkk.', '..kk...', '.k.....', 'kk.....'],       // 닭다리
  코믹: ['.kkkkk.', 'k.....k', 'k.k.k.k', 'k.....k', 'kkkkkkk', 'k.kkk.k', '.kkkkk.'],       // 웃는 얼굴
  희귀: ['...k...', '...k...', 'kkkkkkk', '.kkkkk.', '..kkk..', '.kk.kk.', '.k...k.'],       // 별
  아이돌: ['...kkk.', '...k.kk', '...k..k', '...k...', '.kkk...', 'kkkk...', '.kk....'],     // 음표
};

// 인형: size S/M/L/XL, cost 도매 원가(원), taste 취향 태그, hard 0~1(집기 어려움),
// rank 해금 단계(1=5랭크 … 5=1랭크), special: 특별 공연 한정(공연 전 일주일 동안만 발주). 아이돌 인형은 전부 가상 그룹이다.
DATA.DOLLS = [
  { id: 'chick', name: '꼬마 병아리', size: 'S', cost: 600, taste: ['동물'], hard: 0.0, rank: 1 },
  { id: 'rocket', name: '콩알 로켓', size: 'S', cost: 700, taste: ['코믹'], hard: 0.0, rank: 1 },
  { id: 'breadduck', name: '식빵 오리', size: 'S', cost: 700, taste: ['음식'], hard: 0.05, rank: 1 },
  { id: 'oldrobot', name: '태엽 로봇', size: 'S', cost: 900, taste: ['코믹'], hard: 0.1, rank: 1 },
  { id: 'lumikey', name: '루미나 미니 응원인형', size: 'S', cost: 1100, taste: ['아이돌'], hard: 0.05, rank: 2 },
  { id: 'roundbear', name: '동글 곰', size: 'M', cost: 2400, taste: ['동물'], hard: 0.1, rank: 1 },
  { id: 'berrybunny', name: '딸기 토끼', size: 'M', cost: 2600, taste: ['음식'], hard: 0.1, rank: 1 },
  { id: 'penguin', name: '펭귄 반장', size: 'M', cost: 2500, taste: ['코믹'], hard: 0.1, rank: 1 },
  { id: 'spacecat', name: '우주냥', size: 'M', cost: 3000, taste: ['동물'], hard: 0.15, rank: 1 },
  { id: 'retrofrog', name: '옛날 개구리', size: 'M', cost: 3200, taste: ['코믹'], hard: 0.15, rank: 1 },
  { id: 'rainbowsheep', name: '무지개 양', size: 'M', cost: 4200, taste: ['희귀'], hard: 0.3, rank: 2 },
  { id: 'moonrabbit', name: '달토끼 요정', size: 'M', cost: 4500, taste: ['희귀'], hard: 0.3, rank: 2 },
  { id: 'goldpig', name: '황금 저금 돼지', size: 'M', cost: 5500, taste: ['희귀'], hard: 0.3, rank: 3 },
  { id: 'lumidol', name: '루미나 멤버 인형', size: 'M', cost: 3800, taste: ['아이돌'], hard: 0.15, rank: 2 },
  { id: 'bigbear', name: '뭉치 곰', size: 'L', cost: 7500, taste: ['동물'], hard: 0.1, rank: 1 },
  { id: 'bigburger', name: '왕 햄버거 쿠션', size: 'L', cost: 8000, taste: ['음식'], hard: 0.15, rank: 1 },
  { id: 'cheerbear', name: '루미나 응원봉 곰', size: 'L', cost: 10000, taste: ['아이돌'], hard: 0.2, rank: 2 },
  { id: 'bigoctopus', name: '대왕 문어', size: 'L', cost: 7800, taste: ['코믹'], hard: 0.15, rank: 1 },
  { id: 'classicbear', name: '빈티지 태엽 곰', size: 'L', cost: 11000, taste: ['희귀'], hard: 0.25, rank: 3 },
  { id: 'stagebear', name: '특별 무대 응원 곰', size: 'M', cost: 4800, taste: ['아이돌'], hard: 0.2, rank: 2, special: true },
  // 도전과제 보상으로만 해금되는 인형(locked: true)
  { id: 'goldchick', name: '황금 병아리', size: 'S', cost: 900, taste: ['희귀'], hard: 0.1, rank: 1, locked: true },
  { id: 'rainbowwhale', name: '무지개 고래', size: 'M', cost: 3600, taste: ['동물'], hard: 0.15, rank: 1, locked: true },
  { id: 'arcadecat', name: '오락실 고양이', size: 'M', cost: 3200, taste: ['동물'], hard: 0.1, rank: 1, locked: true },
  { id: 'mooncake', name: '달떡 토끼 쿠션', size: 'L', cost: 8200, taste: ['음식'], hard: 0.15, rank: 1, locked: true },
  { id: 'megabear', name: '거대 뭉치 곰', size: 'XL', cost: 28000, taste: ['동물'], hard: 0, rank: 3 },
  { id: 'jumborobot', name: '초대형 태엽 로봇', size: 'XL', cost: 34000, taste: ['코믹'], hard: 0, rank: 3 },
  { id: 'jumboidol', name: '루미나 점보 마스코트', size: 'XL', cost: 36000, taste: ['아이돌'], hard: 0, rank: 3 },
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

// 손님 분류. 손님마다 '가장 좋아하는 취향'이 하나 있다(그 인형에 가장 끌리고 돈을 더 쓴다).
// tastes: 가장 좋아하는 취향이 정해지는 비중, likesOthers: 다른 취향도 모두 즐기는지, extraLikes: 그 밖에 무작위로 즐기는 취향 수, time: 출몰 시간(show: 공연일 배수). rank: 등장하는 단계.
DATA.CUSTOMERS = [
  { id: 'normal', name: '일반', rank: 1, weight: 1.0, likesOthers: true, tastes: { 동물: 1, 음식: 1, 코믹: 1, 희귀: 1, 아이돌: 1 },
    time: { hours: [12, 20], mult: 1.3, off: 0.8, weekend: 1.3, show: 1.0 } },
  { id: 'mania', name: '마니아', rank: 1, weight: 0.3, likesOthers: true, tastes: { 희귀: 1 },
    time: { hours: [19, 22], mult: 2.2, off: 0.5, weekend: 1.2, show: 0.8 } },
  { id: 'kpop', name: 'K-pop 팬', rank: 2, weight: 0.3, likesOthers: false, extraLikes: 1, tastes: { 아이돌: 1 },
    time: { hours: [13, 19], mult: 1.8, off: 0.6, weekend: 1.2, show: 3.0 } },
];

// 동네 행사(전부 가상): 평일에 열리고, 그 취향을 가장 좋아하는 손님이 몰린다. hours: 붐비는 시간, category: 더 많이 오는 손님 분류
DATA.EVENTS = [
  { id: 'petfest', name: '반려동물 축제', short: '동물 축제', taste: '동물', hours: [11, 17] },
  { id: 'foodmarket', name: '창동 먹거리 장터', short: '먹거리 장터', taste: '음식', hours: [11, 20] },
  { id: 'comicfest', name: '만화 축제', short: '만화 축제', taste: '코믹', hours: [13, 19] },
  { id: 'collector', name: '수집가 교환전', short: '교환전', taste: '희귀', hours: [17, 22], category: 'mania' },
];

// 계절: 여름에 시작해 차례로 돌아온다. 한 해는 네 계절.
DATA.SEASONS = [{ id: 'summer', name: '여름' }, { id: 'autumn', name: '가을' }, { id: 'winter', name: '겨울' }, { id: 'spring', name: '봄' }];

// 날짜 행사: 해마다 그 계절의 day일부터 days일 동안(기본 하루). dayMult: 방문 배수, taste: 몰리는 취향
DATA.HOLIDAYS = [
  { id: 'nightmarket', name: '여름 야시장', short: '여름 야시장', season: 'summer', day: 8, taste: '음식', dayMult: 1.3 },
  { id: 'watergun', name: '물총 축제', short: '물총 축제', season: 'summer', day: 19, taste: '코믹', dayMult: 1.35 },
  { id: 'chuseok', name: '추석 연휴', short: '추석 연휴', season: 'autumn', day: 9, days: 3, taste: '음식', dayMult: 1.3 },
  { id: 'halloween', name: '핼러윈', short: '핼러윈', season: 'autumn', day: 26, taste: '코믹', dayMult: 1.4 },
  { id: 'christmas', name: '크리스마스', short: '크리스마스', season: 'winter', day: 11, days: 2, taste: '동물', dayMult: 1.5 },
  { id: 'newyear', name: '새해 첫날', short: '새해', season: 'winter', day: 17, taste: '코믹', dayMult: 1.3 },
  { id: 'seollal', name: '설날 연휴', short: '설날 연휴', season: 'winter', day: 22, days: 3, taste: '음식', dayMult: 1.25 },
  { id: 'whiteday', name: '화이트데이', short: '화이트데이', season: 'spring', day: 5, taste: '동물', dayMult: 1.25 },
  { id: 'childrens', name: '어린이날', short: '어린이날', season: 'spring', day: 19, taste: '동물', dayMult: 1.5 },
];

// 설비(한 번 사면 영업 중 일이 덜 생긴다). rank: 해금 단계, perMachine: 기계 하나에 다는 개조
DATA.EQUIPMENT = {
  smallbin: { name: '쓰레기통', rank: 1, price: 30000, desc: '놓을수록 청소할 일이 줄어든다.' },
  bin: { name: '대형 쓰레기통', rank: 1, price: 150000, desc: '기본 쓰레기통의 두 배를 담는다.' },
  exchanger: { name: '자동환전기', rank: 2, price: 600000, desc: '가게에 놓으면 환전 요청이 크게 준다.' },
  globalpay: { name: '해외결제 시스템', rank: 3, price: 500000, desc: '외국인 손님의 환전 요청이 없어지고, 외국인이 더 온다.' },
  robot: { name: '로봇 청소기', rank: 4, price: 1200000, desc: '청소할 일이 대부분 없어진다.' },
  capacity: { name: '대용량 진열 개조', rank: 4, price: 300000, perMachine: true, desc: '진열 칸이 1.5배(타이머 기계 제외).' },
  durable: { name: '내구성 개조', rank: 4, price: 250000, perMachine: true, desc: '고장이 크게 준다.' },
};

// 인테리어 소품: wall true면 벽에 걸고(바닥 칸을 안 쓴다), width는 차지하는 칸. charm은 하루 인기도 보너스.
// rank 해금 단계, champion: 전국 1위 뒤에 구입, locked: 도전과제 보상(살 수 없고 받는다)
DATA.DECOR = [
  { id: 'plant', name: '화분', rank: 1, price: 50000, width: 1, charm: 0.4 },
  { id: 'poster', name: '인형 포스터', rank: 1, price: 50000, width: 1, charm: 0.3, wall: true },
  { id: 'bench', name: '휴게 벤치', rank: 2, price: 300000, width: 2, charm: 1.5 },
  { id: 'neon', name: '네온 간판', rank: 2, price: 800000, width: 2, charm: 2.5, wall: true },
  { id: 'photozone', name: '포토존', rank: 3, price: 3000000, width: 2, charm: 6 },
  { id: 'aquarium', name: '대형 수족관', rank: 4, price: 8000000, width: 2, charm: 10 },
  { id: 'mascot', name: '대형 마스코트 조형물', rank: 5, price: 15000000, width: 2, charm: 14 },
  { id: 'ledboard', name: '아레나 연동 전광판', rank: 5, price: 50000000, width: 3, charm: 25, wall: true },
  { id: 'goldstatue', name: '황금 인형 동상', rank: 5, price: 100000000, width: 2, charm: 35, champion: true },
  { id: 'trophy', name: '새내기 트로피', rank: 1, price: 0, width: 1, charm: 1, locked: true },
  { id: 'arcadeset', name: '추억의 오락기', rank: 1, price: 0, width: 1, charm: 3, locked: true },
  { id: 'goldframe', name: '황금 액자', rank: 1, price: 0, width: 1, charm: 3, wall: true, locked: true },
  { id: 'crown', name: '챔피언 왕관 전시대', rank: 1, price: 0, width: 1, charm: 20, locked: true },
];

// 도전과제: stat(코어가 세는 값)이 goal 이상이면 달성. reward: money(원) / doll(해금) / decor(지급)
DATA.ACHIEVEMENTS = [
  { id: 'open', group: '성장', name: '개업 첫날', desc: '첫 영업을 마친다', stat: 'days', goal: 1, reward: { money: 100000 } },
  { id: 'rank4', group: '성장', name: '상권 대표', desc: '4랭크에 오른다', stat: 'rank', goal: 2, reward: { decor: 'trophy' } },
  { id: 'rank3', group: '성장', name: '도시 명소', desc: '3랭크에 오른다', stat: 'rank', goal: 3, reward: { doll: 'rainbowwhale' } },
  { id: 'rank2', group: '성장', name: '지역 강자', desc: '2랭크에 오른다', stat: 'rank', goal: 4, reward: { money: 2000000 } },
  { id: 'rank1', group: '성장', name: '전국구', desc: '1랭크에 오른다', stat: 'rank', goal: 5, reward: { decor: 'goldframe' } },
  { id: 'champion', group: '성장', name: '전국 1등', desc: '전국 순위 1위를 차지한다', stat: 'champion', goal: 1, reward: { decor: 'crown' } },
  { id: 'rev50', group: '장사', name: '잘나가는 날', desc: '하루 매출 50만 원', stat: 'bestRevenue', goal: 500000, reward: { money: 200000 } },
  { id: 'rev150', group: '장사', name: '대박 난 날', desc: '하루 매출 150만 원', stat: 'bestRevenue', goal: 1500000, reward: { doll: 'mooncake' } },
  { id: 'win100', group: '장사', name: '인형 100개', desc: '손님이 인형을 누적 100개 뽑는다', stat: 'wins', goal: 100, reward: { doll: 'goldchick' } },
  { id: 'win3000', group: '장사', name: '인형 3,000개', desc: '손님이 인형을 누적 3,000개 뽑는다', stat: 'wins', goal: 3000, reward: { money: 3000000 } },
  { id: 'total1', group: '장사', name: '누적 1억', desc: '누적 매출 1억 원', stat: 'totalRevenue', goal: 100000000, reward: { money: 5000000 } },
  { id: 'fast', group: '운영', name: '번개 사장', desc: '직접 운영한 날, 할 일 5개 이상을 모두 30분(게임 시각) 안에 처리', stat: 'fastDays', goal: 1, reward: { money: 300000 } },
  { id: 'stocked', group: '운영', name: '품절 없는 일주일', desc: '빈 기계 때문에 돌아간 손님 없이 7일 연속 영업', stat: 'bestStockStreak', goal: 7, reward: { decor: 'arcadeset' } },
  { id: 'dolls12', group: '수집', name: '인형 수집가', desc: '서로 다른 인형 12종을 진열한다', stat: 'dollKinds', goal: 12, reward: { money: 500000 } },
  { id: 'dolls20', group: '수집', name: '인형 박사', desc: '서로 다른 인형 20종을 진열한다', stat: 'dollKinds', goal: 20, reward: { doll: 'arcadecat' } },
  { id: 'machines', group: '수집', name: '기계 사총사', desc: '네 종류의 기계를 모두 갖춘다', stat: 'machineKinds', goal: 4, reward: { money: 1000000 } },
  { id: 'decor5', group: '꾸미기', name: '꾸미기 시작', desc: '소품 5개를 놓는다', stat: 'decorCount', goal: 5, reward: { money: 300000 } },
  { id: 'charm40', group: '꾸미기', name: '사진 맛집', desc: '소품 매력 합계 40', stat: 'charm', goal: 40, reward: { money: 3000000 } },
  { id: 'statue', group: '꾸미기', name: '황금의 가게', desc: '황금 인형 동상을 놓는다', stat: 'statue', goal: 1, reward: { money: 10000000 } },
];
