// 게임 데이터(문구, 스프라이트 등)를 여기에 모은다.
const DATA = {
  TITLE_LINES: ['인형뽑기 고수인 내가', '최고 랭크 사장이 되어보려고 합니다'],
  RANK_NAMES: ['동네 가게', '상권 대표', '도시 명소', '전국구', '세계구'],

  // 프롤로그(이름을 정하기 전까지의 이야기). 마지막 줄 다음에 이름 입력이 나온다.
  INTRO: [
    '창동에 새 아레나가 문을 연다는 소식이 들렸다.',
    '공연이 열리는 날이면 사람들이 구름처럼 몰려들 거라고 한다.',
    '인형뽑기라면 누구에게도 지지 않는다. 고수라는 소리도 꽤 들었다.',
    '그렇다면 이제 구경하는 쪽이 아니라, 기계를 놓는 쪽이 될 차례다.',
    '가게 신청서를 쓰려는데, 사장 이름 칸이 비어 있다……',
  ],
  NAME_PROMPT: '사장 이름을 적어 주세요',

  HOWTO: [
    '인형뽑기 고수인 주인공이 아레나 상권에 가게를 차려요.',
    '번 돈으로 기계, 인형, 시설을 업그레이드해요.',
    '가게 랭크를 올려 인기도 랭킹 1위에 도전해요.',
    '돈이 다 떨어지면 폐업! 신중하게 운영하세요.',
  ],
  CREDIT_LINE: '폰트: Galmuri (SIL OFL 1.1)',

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
