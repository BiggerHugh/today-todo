const { aiRefine, addGoalsBatch } = require('../../utils/api');

Page({
  data: {
    state: 'idle', // idle | recording | processing | done | error
    rawText: '',
    refinedGoals: [],
    recordingTimer: 0,
    recordingInterval: null,
    errorMsg: '',
    recorderDisabled: false,
    voiceFile: null,
  },

  // 微信录音管理器
  recorderManager: null,

  onLoad() {
    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager();
    
    this.recorderManager.onStop((res) => {
      const { tempFilePath, duration } = res;
      if (duration < 1000) {
        this.setData({ state: 'idle', errorMsg: '' });
        wx.showToast({ title: '说话时间太短', icon: 'none' });
        return;
      }
      this.setData({ voiceFile: tempFilePath });
      this.doSpeechRecognition(tempFilePath);
    });

    this.recorderManager.onError((err) => {
      console.error('录音失败', err);
      this.setData({ state: 'error', errorMsg: '录音权限不足，请在设置中开启麦克风权限' });
    });
  },

  // 开始录音
  startRecord() {
    if (this.data.recorderDisabled) return;
    
    this.setData({ state: 'recording', recordingTimer: 0 });

    // 倒计时
    const interval = setInterval(() => {
      const t = this.data.recordingTimer + 1;
      if (t >= 60) {
        this.stopRecord();
        return;
      }
      this.setData({ recordingTimer: t });
    }, 1000);

    this.setData({ recordingInterval: interval });

    this.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
    });
  },

  // 停止录音
  stopRecord() {
    if (this.data.state !== 'recording') return;
    
    clearInterval(this.data.recordingInterval);
    this.recorderManager.stop();
  },

  // 语音识别（使用微信云开发的语音识别，或降级走文本方案）
  doSpeechRecognition(filePath) {
    this.setData({ state: 'processing' });

    // 方案：微信基础库 2.33+ 支持语音识别插件
    // 这里先用微信同声传译插件，如果不可用则提示用户手动输入
    const plugin = requirePlugin('WechatSI');
    if (plugin && plugin.manager) {
      plugin.manager.onRecognize = (res) => {
        console.log('识别中间结果', res);
      };
      plugin.manager.onStart = () => {
        console.log('开始识别');
      };
      plugin.manager.onError = (err) => {
        console.error('识别失败', err);
        this.fallbackToManual();
      };
      plugin.manager.onStop = (res) => {
        const text = (res.result || '').replace(/[。，、]/g, ' ').trim();
        if (text) {
          this.setData({ rawText: text });
          this.doAIRefine(text);
        } else {
          this.fallbackToManual();
        }
      };
      plugin.manager.speechToText(filePath);
    } else {
      // 插件不可用：降级到手动输入
      this.fallbackToManual();
    }
  },

  // 降级：引导用户手动输入
  fallbackToManual() {
    this.setData({ state: 'idle' });
    wx.showModal({
      title: '暂不支持语音识别',
      content: '请在下方输入你今天的目标，AI 会帮你提炼',
      showCancel: true,
      confirmText: '去输入',
      success: (res) => {
        if (res.confirm) {
          // 跳回首页手动输入
          wx.navigateBack();
        }
      },
    });
  },

  // AI 提炼
  async doAIRefine(text) {
    try {
      const res = await aiRefine(text);
      const items = res.items || [];
      if (items.length === 0) {
        this.setData({
          state: 'error',
          errorMsg: 'AI 没有识别出明确的目标，请重试',
          rawText: text,
        });
        return;
      }
      this.setData({
        state: 'done',
        refinedGoals: items,
      });
    } catch (err) {
      console.error('AI 提炼失败', err);
      // 降级：把原始文本作为一条目标
      this.setData({
        state: 'done',
        refinedGoals: [text],
        rawText: text,
      });
    }
  },

  // 编辑单条目标
  onGoalTextChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const goals = [...this.data.refinedGoals];
    goals[index] = value;
    this.setData({ refinedGoals: goals });
  },

  editGoal(e) {
    // 点击聚焦到编辑输入框
  },

  // 删除单条
  removeGoal(e) {
    const index = e.currentTarget.dataset.index;
    const goals = [...this.data.refinedGoals];
    goals.splice(index, 1);
    if (goals.length === 0) {
      this.setData({ state: 'idle', refinedGoals: [] });
    } else {
      this.setData({ refinedGoals: goals });
    }
  },

  // 新增空目标
  addEmptyGoal() {
    const goals = [...this.data.refinedGoals, ''];
    this.setData({ refinedGoals: goals });
  },

  // 确认添加
  async confirmGoals() {
    const items = this.data.refinedGoals.filter(t => t.trim());
    if (items.length === 0) return;

    wx.showLoading({ title: '添加中...' });
    try {
      await addGoalsBatch(items);
      wx.hideLoading();
      wx.showToast({ title: `已添加 ${items.length} 条目标`, icon: 'success', duration: 1500 });
      setTimeout(() => {
        wx.navigateBack();
      }, 1200);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  // 重置状态
  resetState() {
    this.setData({
      state: 'idle',
      rawText: '',
      refinedGoals: [],
      recordingTimer: 0,
      errorMsg: '',
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  },

  // 计算有效目标数
  get validGoalCount() {
    return this.data.refinedGoals.filter(t => t.trim()).length;
  },
});
