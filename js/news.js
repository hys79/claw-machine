// 인형뽑기 주간지의 소식: 지금 날짜와 가게 상태로 기사를 만든다(계산 없이 읽기만 한다).
const News = (function () {
  const AHEAD = 7; // 행사·특별 공연을 며칠 전부터 알리는지

  // 그 주(week)에 아레나에서 공연하는 가상 그룹
  const groupOf = (st, week) => DATA.IDOLS[(st.seed + week) % DATA.IDOLS.length];
  const when = (n) => (n === 0 ? '오늘' : n === 1 ? '내일' : n + '일 뒤');

  // 기사 목록 [{tag, color, title, lines[]}]. dateText(day): 날짜 표기
  function list(st, dateText) {
    const out = [], day = st.day, week = Math.floor((day - 1) / 7);
    const idolOpen = st.rank >= DATA.CUSTOMERS.find((c) => c.id === 'kpop').rank;

    // 유행
    const dolls = DATA.DOLLS.filter((d) => d.taste[0] === st.trend.taste && Sim.orderable(st, d)).slice(0, 3).map((d) => d.name);
    out.push({ tag: '유행', color: '#8a4fc0', title: '요즘 유행은 ' + st.trend.taste + ' 인형!', lines: [
      (dolls.length ? '대표: ' + dolls.join(', ') + '. ' : '') + '찾는 손님이 늘고 도매가도 올라요',
      '다음 유행 예고: ' + st.trend.next + ' (' + when(Math.max(1, st.trend.until - day)) + '부터)',
    ] });

    // 특별 공연(일주일 전부터)
    const special = Sim.nextSpecial(day), left = special - day;
    if (left <= AHEAD) {
      const limited = DATA.DOLLS.filter((d) => d.special).map((d) => d.name).join(', ');
      out.push({ tag: '특별', color: '#b07a10', title: when(left) + ' 특별 공연: ' + groupOf(st, Math.floor((special - 1) / 7)).name, lines: [
        dateText(special) + ' · 손님이 폭증해요',
        !idolOpen ? '한정 인형은 4랭크부터 팔 수 있어요' : left ? '한정 인형(' + limited + ')을 지금 발주할 수 있어요' : '아이돌 인형을 가득 채워 두세요',
      ] });
    }

    // 이번 주말 공연(지났거나 특별 공연이면 다음 주)
    let w = week;
    const weekend = (k) => [k * 7 + 6, k * 7 + 7].filter((d) => d >= day && Sim.info.isShowDay(d) && !Sim.info.isSpecialDay(d));
    if (!weekend(w).length) w++;
    const shows = weekend(w);
    if (shows.length) {
      const g = groupOf(st, w);
      out.push({ tag: '공연', color: CFG.COLOR.alert, title: (w === week ? '이번 주말' : '다음 주말') + ' 아레나 공연: ' + g.name, lines: [
        dateText(shows[0]) + ' · ' + g.note,
        idolOpen ? 'K-pop 팬과 외국인이 몰려요. 아이돌 인형을 넉넉히!' : '외국인 손님이 늘어요. 아이돌 인형은 4랭크부터 팔아요',
      ] });
    }

    // 날짜 행사: 일주일 안의 것, 없으면 다음 것 하나
    const soon = [];
    for (let d = day; d < day + CFG.SIM.SEASON_DAYS * 4 && soon.length < 2; d++) {
      const h = Sim.info.holidayOf(d);
      if (h && (d - day <= AHEAD || !soon.length)) soon.push([d, h]);
      if (d - day > AHEAD && soon.length) break;
    }
    soon.forEach(([d, h]) => {
      const near = d - day <= AHEAD;
      out.push({ tag: '행사', color: '#a5521a', title: near ? when(d - day) + ' ' + h.name + '!' : '다음 행사: ' + h.name + ' (' + when(d - day) + ')', lines: [
        dateText(d) + ' · 손님이 평소보다 많아져요',
        near ? '좀 있으면 ' + h.short + '! 발주를 넉넉히 넣어 두세요' : '날짜가 다가오면 다시 알려 드릴게요',
      ] });
    });

    // 계절: 새 계절 첫 주와 마지막 주
    const c = Sim.info.calOf(day);
    if (c.day <= 7 || c.day > CFG.SIM.SEASON_DAYS - 7) {
      const turning = c.day > 7, s = DATA.SEASONS[(c.season + (turning ? 1 : 0)) % 4];
      out.push({ tag: '계절', color: CFG.COLOR.blue, title: turning ? '곧 ' + s.name + '이에요' : s.name + '이 시작됐어요', lines: [s.tip] });
    }
    return out.slice(0, 6);
  }

  return { list };
})();
