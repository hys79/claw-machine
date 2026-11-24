// 게임 데이터(문구, 스프라이트 등)를 여기에 모은다.
const DATA = {
  TITLE_LINES: ['인형뽑기 고수인 내가', '최고 랭크 사장이 되어보려고 합니다'],
  SUBTITLE: '창동 아레나 인형뽑기 타이쿤',
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
  PALETTE: { k: '#14324d', r: '#ff77a8', w: '#fff1e8', g: '#8fd3ff', y: '#ffd84a', p: '#ff9fc2' },
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
  GEAR: [
    '....kkk....',
    '..k.kkk.k..',
    '.kkkkkkkkk.',
    '..kkkkkkk..',
    'kkkk...kkkk',
    'kkkk...kkkk',
    'kkkk...kkkk',
    '..kkkkkkk..',
    '.kkkkkkkkk.',
    '..k.kkk.k..',
    '....kkk....',
  ],
  // 메인 화면 그림(코드로 그리는 도트 풍경) 색
  SCENE: {
    skyTop: '#bfe3f5', skyBottom: '#e6f4fb', cloud: '#ffffff',
    dome: '#c9d9e6', domeDark: '#9fb6c9', domeLine: '#14324d', sign: '#2f80d0',
    ground: '#8aa9be', groundLine: '#14324d',
  },
};
