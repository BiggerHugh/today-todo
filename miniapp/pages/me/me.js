const { getStats, getUserSettings, updateUserSettings } = require('../../utils/api');

Page({
  data: {
    stats: {
      streak: 0,
      totalDays: 0,
      completionRate: 0,
      totalGoals: 0,
      doneGoals: 0,
    },
    settings: {
      morningReminder: true,
      morningTime: '08:00',
      eveningReminder: true,
      eveningTime: '21:00',
    },
  },

  onShow() {
    this.loadStats();
    this.loadSettings();
  },

  async loadStats() {
    try {
      const stats = await getStats();
      this.setData({ stats });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  async loadSettings() {
    try {
      const res = await getUserSettings();
      if (res.settings) {
        this.setData({ settings: res.settings });
      }
    } catch (err) {
      console.error('加载设置失败', err);
    }
  },

  async saveSettings() {
    try {
      await updateUserSettings(this.data.settings);
    } catch (err) {
      console.error('保存设置失败', err);
    }
  },

  // 切换早上提醒
  toggleMorning(e) {
    const settings = { ...this.data.settings, morningReminder: e.detail.value };
    this.setData({ settings });
    this.saveSettings();
  },

  // 切换晚上提醒
  toggleEvening(e) {
    const settings = { ...this.data.settings, eveningReminder: e.detail.value };
    this.setData({ settings });
    this.saveSettings();
  },

  // 早上提醒时间
  onMorningTimeChange(e) {
    const settings = { ...this.data.settings, morningTime: e.detail.value };
    this.setData({ settings });
    this.saveSettings();
  },

  // 晚上提醒时间
  onEveningTimeChange(e) {
    const settings = { ...this.data.settings, eveningTime: e.detail.value };
    this.setData({ settings });
    this.saveSettings();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '今日事今日毕 🌱 每天对自己做一次承诺',
      path: '/pages/index/index',
    };
  },
});
