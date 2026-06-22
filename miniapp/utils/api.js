const API = 'https://todaydone.cloud/api';

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    // 获取 openid（首次从微信获取后缓存）
    const openid = wx.getStorageSync('openid') || 'default';

    wx.request({
      url: API + path,
      method,
      header: { 'Content-Type': 'application/json' },
      data: data ? { ...data, openid } : { openid },
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
