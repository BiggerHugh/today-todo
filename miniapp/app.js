App({
  onLaunch() {
    // 获取用户 openid
    wx.login({
      success: res => {
        if (res.code) {
          // 注：正式上线需后端用 code 换取 openid
          // 这里用临时方案
          const cached = wx.getStorageSync('openid');
          if (!cached) {
            wx.setStorageSync('openid', 'wx_' + Date.now().toString(36));
          }
        }
      },
    });
  },
  globalData: {
    userOpenid: null,
  },
});
