// 게임 상태와 저장/불러오기
const State = {
  data: null,
  fresh() {
    return { season: 1, week: 1, shards: 0, stats: { ...CFG.START_STATS } };
  },
  load() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      this.data = raw ? JSON.parse(raw) : this.fresh();
    } catch (e) {
      this.data = this.fresh();
    }
  },
  save() {
    try { localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },
  wipe() {
    localStorage.removeItem(CFG.SAVE_KEY);
    this.data = this.fresh();
  },
};
