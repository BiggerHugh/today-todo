// ============================
// 🌐 环境配置
// ============================
// 本地开发 → 自动使用 HTTP IP（不校验合法域名）
// 生产环境 → 填入你已备案的 HTTPS 域名
// ============================

const DEV_API = 'http://43.136.44.88/api';      // 本地调试用，无需备案
const PROD_API = 'http://43.136.44.88/api';      // 🔁 上线时替换为你的备案 HTTPS 域名，例如：'https://jrsjrb.cn/api'

// 自动判断环境：开发者工具内未开「不校验合法域名」时，用 HTTP IP
// 如果你想手动切换，直接把下面这行改成 PROD_API 或 DEV_API
const API = PROD_API;

// 目前 todaydone.cloud 未备案，暂用 HTTP IP
// 等你有备案域名后，把 PROD_API 改成 https://你的域名/api 即可
// ============================

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const openid = wx.getStorageSync('openid') || 'default';

    wx.request({
      url: API + path,
      method,
      header: { 'Content-Type': 'application/json' },
      data: data ? { ...data, openid } : { openid },
      timeout: 10000,
      success: res => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: err => reject(err),
    });
  });
}

// 目标 API
function getTodayGoals(date) {
  const q = date ? `?date=${date}` : '';
  return request('GET', `/goals/today${q}`);
}

function addGoal(text) {
  return request('POST', '/goals', { text });
}

function addGoalsBatch(items) {
  return request('POST', '/goals/batch', { items });
}

function updateGoal(id, data) {
  return request('PUT', `/goals/${id}`, data);
}

function reorderGoals(items) {
  return request('PUT', '/goals/reorder', { items });
}

function deleteGoal(id) {
  return request('DELETE', `/goals/${id}`);
}

function getHistory(start, end) {
  return request('GET', `/goals/history?start=${start}&end=${end}`);
}

function getStats() {
  return request('GET', '/goals/stats');
}

// AI
function aiRefine(text) {
  return request('POST', '/ai/refine', { text });
}

// 用户设置
function getUserSettings() {
  return request('GET', '/user/settings');
}

function updateUserSettings(settings) {
  return request('PUT', '/user/settings', { settings });
}

module.exports = {
  API,
  getTodayGoals,
  addGoal,
  addGoalsBatch,
  updateGoal,
  reorderGoals,
  deleteGoal,
  getHistory,
  getStats,
  aiRefine,
  getUserSettings,
  updateUserSettings,
};
