// 게임 데이터(문구, 스프라이트 등)를 여기에 모은다.
const DATA = {
  // 타이틀: [글, 크기, 색] 조각을 한 줄로 잇는다(강조할 부분만 크게).
  TITLE_ROWS: [
    [['인형뽑기', 44, 'white'], [' 고수인 내가', 28, 'white']],
    [['최고 랭크 사장이', 64, 'yellow'], [' 되어보려고 합니다', 28, 'white']],
  ],
  RANK_NAMES: ['동네 가게', '상권 대표', '도시 명소', '전국구', '세계구'],

  // 프롤로그 컷신 대본. 마지막 장면이 끝나면 이름 입력(가게 신청서)이 나온다.
  // bg: arcade(오락실 안) | site(공사 중인 아레나) | arena(완공된 아레나), light: 화면 색 입힘, props: 소품, crowd: 사람 수
  // actors: 등장 인물(x, y는 발 위치, 도트 좌표 0~240). 단계: narr, say(태그, 글), wait(초), move(id, x, 속도, true=끝날 때까지 대기),
  //         emote(id, !/bulb), flash, shake(세기), title(큰 글, 작은 글)
  STORY: [
    { bg: 'arcade', actors: [{ id: 'me', x: 133, y: 106 }], steps: [
      ['wait', 0.5],
      ['narr', '오늘도 평소처럼 인형뽑기를 즐기고 있다.'],
      ['say', '나', '좋아, 조금만 더… 오른쪽!'],
      ['shake', 3], ['emote', 'me', '!'], ['wait', 0.9],
      ['say', '나', '역시 나라니까. 인형뽑기라면 누구에게도 안 져.'],
    ] },
    { bg: 'site', actors: [{ id: 'me', x: 20, y: 106 }], steps: [
      ['narr', '그러던 어느 날, 창동에 새롭게 대형 공연장이 지어진다는 소식을 들었다.'],
      ['move', 'me', 92, 34, true],
      ['emote', 'me', '!'], ['wait', 0.6],
      ['say', '나', '여기에… 그 대형 공연장이 들어선다고?'],
    ] },
    { bg: 'arena', crowd: 40, actors: [{ id: 'me', x: 38, y: 106 }], steps: [
      ['narr', '공연이 열리는 날이면 수많은 사람들과 외국인들이 몰려들 것이다.'],
      ['narr', '이곳에 완전히 새로운 상권이 열리는 것이다.'],
    ] },
    { bg: 'arena', light: 'dusk', crowd: 14, actors: [{ id: 'me', x: 118, y: 106 }], steps: [
      ['wait', 0.4],
      ['emote', 'me', 'bulb'], ['wait', 1.0],
      ['say', '나', '이 근처에 인형뽑기 가게를 차리면… 성공하지 않을까?'],
      ['narr', '그 순간, 머릿속에 불이 켜졌다.'],
    ] },
    { bg: 'arena', props: ['shop'], crowd: 9, actors: [{ id: 'me', x: 92, y: 106 }], steps: [
      ['narr', '그렇게 나는 창동 아레나 근처에서 작은 인형뽑기 가게를 운영하게 되는데……'],
      ['title', '창동 아레나 근처', '작은 인형뽑기 가게의 첫 이야기'],
      ['narr', '가게 신청서를 쓰려는데, 사장 이름 칸이 비어 있다……'],
    ] },
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
