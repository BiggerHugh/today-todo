const { getTodayGoals, addGoal, updateGoal, getStats } = require('../../utils/api');
const { today, weekDay, monthDay } = require('../../utils/util');

Page({
  data: {
    bgColor: '#D4E7ED',
    dayNum: '',
    monthStr: '',
    weekStr: '',
    greetingText: '',
    goals: [],
    doneCount: 0,
    completionPercent: 0,
    streak: 0,
    showInput: false,
    inputText: '',
    inputFocus: false,
    dragging: false,
    dragIndex: -1,
  },

  onShow() {
    this.loadGoals();
    this.loadStats();
    this.setDateInfo();
    this.setGreeting();
  },

  // 设置日期信息
  setDateInfo() {
    const d = new Date();
    this.setData({
      dayNum: String(d.getDate()),
      monthStr: `${d.getMonth() + 1}月`,
      weekStr: weekDay(today()),
    });
  },

  // 设置问候语
  setGreeting() {
    const h = new Date().getHours();
    let texts = [];
    if (h < 9) texts = ['新的一天，你有什么计划？', '早安，说说今天的目标吧 💪'];
    else if (h < 12) texts = ['上午好，今天想完成什么？', '一天之计在于晨 🌞'];
    else if (h < 14) texts = ['中午好，下午有什么安排？', '午饭过后，理一理待办'];
    else if (h < 18) texts = ['下午好，还有时间实现目标', '趁天黑前再冲刺一把 🚀'];
    else if (h < 21) texts = ['晚上好，回顾一下今天吧', '今天完成了哪些事？'];
    else texts = ['夜深了，准备好明天的目标吗', '今日事今日毕 🌙'];

    const bgColors = [
      '#D4E7ED', '#E8E0D8', '#DCE8D5', '#F5E5D5', '#E5DCF0', '#D5E8F0', '#F0E5D8'
    ];
    const bg = bgColors[Math.floor(Math.random() * bgColors.length)];

    this.setData({
      greetingText: texts[Math.floor(Math.random() * texts.length)],
      bgColor: bg,
    });
  },

  // 加载今日目标
  async loadGoals() {
    try {
      const res = await getTodayGoals();
      const goals = (res.goals || []).map(g => ({
        ...g,
        createdAt: this.formatTime(g.createdAt),
      }));
      const doneCount = goals.filter(g => g.done).length;
      const completionPercent = goals.length > 0
        ? Math.round((doneCount / goals.length) * 100)
        : 0;

      this.setData({ goals, doneCount, completionPercent });
    } catch (err) {
      console.error('加载目标失败', err);
    }
  },

  // 加载统计（连续天数）
  async loadStats() {
    try {
      const stats = await getStats();
      this.setData({ streak: stats.streak || 0 });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  // 格式化时间
  formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  // 切换完成状态
  async toggleDone(e) {
    const id = e.currentTarget.dataset.id;
    const goal = this.data.goals.find(g => g.id === id);
    if (!goal) return;

    // 乐观更新
    const done = !goal.done;
    goal.done = done;
    const doneCount = goal.done ? this.data.doneCount + 1 : this.data.doneCount - 1;
    const completionPercent = this.data.goals.length > 0
      ? Math.round((doneCount / this.data.goals.length) * 100)
      : 0;

    this.setData({
      goals: [...this.data.goals],
      doneCount,
      completionPercent,
    });

    try {
      await updateGoal(id, { done });
      // 震动反馈
      wx.vibrateShort({ type: 'light' });
    } catch (err) {
      // 回滚
      goal.done = !done;
      this.setData({ goals: [...this.data.goals] });
      console.error('更新失败', err);
    }
  },

  // 长按排序
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const index = this.data.goals.findIndex(g => g.id === id);
    if (index === -1) return;

    wx.vibrateShort({ type: 'medium' });
    this.setData({ dragIndex: index });
    wx.showToast({ title: '拖动右侧手柄排序', icon: 'none', duration: 1500 });
  },

  onHandleMove(e) {
    // 拖拽排序的触摸事件
    // 微信小程序暂不支持完整的原生拖拽，这里预留接口
    // 后续可以接入 movable-view 实现
  },

  // 跳转语音页
  goVoice() {
    wx.navigateTo({ url: '/pages/voice/voice' });
  },

  // 跳转日历
  goHistory() {
    wx.switchTab({ url: '/pages/calendar/calendar' });
  },

  // 手动输入
  toggleInput() {
    this.setData({
      showInput: true,
      inputFocus: true,
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  cancelInput() {
    this.setData({
      showInput: false,
      inputText: '',
      inputFocus: false,
    });
  },

  async quickAdd() {
    const text = this.data.inputText.trim();
    if (!text) return;

    try {
      await addGoal(text);
      this.setData({
        showInput: false,
        inputText: '',
        inputFocus: false,
      });
      this.loadGoals();
      this.loadStats();
      wx.vibrateShort({ type: 'light' });
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '今日事今日毕 🌱',
      path: '/pages/index/index',
    };
  },
});
