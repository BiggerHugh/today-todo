const { getHistory } = require('../../utils/api');
const { today, fullDate } = require('../../utils/util');

Page({
  data: {
    year: 0,
    month: 0,
    dates: [],
    selectedDate: '',
    selectedDateText: '',
    selectedGoals: [],
    selectedDone: 0,
    historyMap: {},
  },

  onShow() {
    const d = new Date();
    this.setData({ year: d.getFullYear(), month: d.getMonth() + 1 });
    this.loadCalendar();
    this.loadHistory();
    // 默认选中今天
    this.selectDateByStr(today());
  },

  // 生成日历格子
  loadCalendar() {
    const { year, month } = this.data;
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = today();

    const dates = [];

    // 补齐前面的空白
    for (let i = 0; i < firstDay; i++) {
      dates.push({ empty: true });
    }

    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      dates.push({
        empty: false,
        day: d,
        date: dateStr,
        isToday,
        rate: -1, // 默认：无数据
      });
    }

    this.setData({ dates });
    // 填充历史数据
    this.fillHistoryRates();
  },

  // 加载历史数据
  async loadHistory() {
    try {
      const start = `${this.data.year}-01-01`;
      const end = `${this.data.year}-12-31`;
      const res = await getHistory(start, end);
      const map = {};
      for (const day of (res.days || [])) {
        const total = day.goals.length;
        const done = day.goals.filter(g => g.done).length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;
        map[day.date] = { total, done, rate, goals: day.goals };
      }
      this.setData({ historyMap: map });
      // 重新填充格子的完成度
      this.fillHistoryRates();
    } catch (err) {
      console.error('加载历史失败', err);
    }
  },

  // 填充每个格子的完成度
  fillHistoryRates() {
    const dates = [...this.data.dates];
    const map = this.data.historyMap;

    for (const cell of dates) {
      if (cell.empty) continue;
      const info = map[cell.date];
      if (info && info.total > 0) {
        cell.rate = info.rate;
      } else {
        cell.rate = -1;
      }
    }

    this.setData({ dates });
  },

  // 选中某天
  selectDate(e) {
    const date = e.currentTarget.dataset.date;
    if (!date) return;
    this.selectDateByStr(date);
  },

  selectDateByStr(dateStr) {
    const info = this.data.historyMap[dateStr];
    const goals = info ? info.goals : [];
    const done = goals.filter(g => g.done).length;

    this.setData({
      selectedDate: dateStr,
      selectedDateText: fullDate(dateStr),
      selectedGoals: goals,
      selectedDone: done,
    });
  },

  // 切换月份
  prevMonth() {
    let { year, month } = this.data;
    if (month === 1) {
      year--;
      month = 12;
    } else {
      month--;
    }
    this.setData({ year, month });
    this.loadCalendar();
    this.loadHistory();
  },

  nextMonth() {
    let { year, month } = this.data;
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    if (targetMonth >= thisMonth) return;

    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
    this.setData({ year, month });
    this.loadCalendar();
    this.loadHistory();
  },
});
