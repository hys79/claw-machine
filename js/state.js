// 게임 상태와 저장/불러오기
const State = {
  data: null,
  fresh() {
    return { playerName: '', shopName: '', rankIntro: false, money: CFG.START_MONEY, rank: CFG.START_RANK, day: 1 };
  },
  load() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      this.data = raw ? Object.assign(this.fresh(), JSON.parse(raw)) : this.fresh();
    } catch (e) {
      this.data = this.fresh();
    }
  },
  save() {
    try { localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  wipe() {
    try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
    this.data = this.fresh();
  },
  hasSave() {
    return !!this.data.playerName && !!this.data.shopName; // 이름과 가게 이름을 정해야 저장으로 친다
  },
};
