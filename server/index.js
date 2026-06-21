const express = require('express');
const cors = require('cors');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库
const defaultData = { goals: [], users: [] };
const db = new Low(new JSONFile(__dirname + '/data.json'), defaultData);

// DeepSeek 客户端
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

// ============ 启动时初始化 ============
(async () => {
  await db.read();
  db.data ||= { goals: [], users: [] };
  if (!db.data.goals) db.data.goals = [];
  if (!db.data.users) db.data.users = [];
  await db.write();
  console.log('📦 数据库已就绪');
})();

// ============ API ============

// 健康检查
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// ========== 目标相关 ==========

// 获取今日目标
app.get('/api/goals/today', (req, res) => {
  const { date } = req.query;
  const targetDate = date || today();
  const openid = req.query.openid || 'default';

  const goals = (db.data.goals || [])
    .filter(g => g.date === targetDate && g.openid === openid)
    .sort((a, b) => a.order - b.order);

  res.json({ goals, date: targetDate });
});

// 添加目标
app.post('/api/goals', async (req, res) => {
  const { text, openid } = req.body;
  if (!text) return res.status(400).json({ error: '内容不能为空' });

  const date = today();
  const goals = db.data.goals || [];
  const maxOrder = goals
    .filter(g => g.date === date && g.openid === (openid || 'default'))
    .reduce((m, g) => Math.max(m, g.order), -1);

  const goal = {
    id: genId(),
    openid: openid || 'default',
    date,
    text: text.trim(),
    done: false,
    order: maxOrder + 1,
    createdAt: Date.now(),
  };

  db.data.goals.push(goal);
  await db.write();

  res.json({ goal });
});

// 批量添加目标（AI提炼后）
app.post('/api/goals/batch', async (req, res) => {
  const { items, openid } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: '目标列表不能为空' });

  const date = today();
  const existing = (db.data.goals || [])
    .filter(g => g.date === date && g.openid === (openid || 'default'));
  let maxOrder = existing.reduce((m, g) => Math.max(m, g.order), -1);

  const newGoals = items.map((text, i) => ({
    id: genId(),
    openid: openid || 'default',
    date,
    text: text.trim(),
    done: false,
    order: maxOrder + i + 1,
    createdAt: Date.now(),
  }));

  db.data.goals.push(...newGoals);
  await db.write();

  res.json({ goals: newGoals });
});

// 更新目标
app.put('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { text, done, order } = req.body;

  const goal = (db.data.goals || []).find(g => g.id === id);
  if (!goal) return res.status(404).json({ error: '目标不存在' });

  if (text !== undefined) goal.text = text;
  if (done !== undefined) goal.done = done;
  if (order !== undefined) goal.order = order;

  await db.write();
  res.json({ goal });
});

// 批量更新排序
app.put('/api/goals/reorder', async (req, res) => {
  const { items } = req.body;
  for (const item of items) {
    const goal = (db.data.goals || []).find(g => g.id === item.id);
    if (goal) goal.order = item.order;
  }
  await db.write();
  res.json({ ok: true });
});

// 删除目标
app.delete('/api/goals/:id', async (req, res) => {
  const { id } = req.params;
  const idx = (db.data.goals || []).findIndex(g => g.id === id);
  if (idx === -1) return res.status(404).json({ error: '目标不存在' });

  db.data.goals.splice(idx, 1);
  await db.write();
  res.json({ ok: true });
});

// 获取历史目标（按日期范围）
app.get('/api/goals/history', (req, res) => {
  const { start, end, openid } = req.query;
  const uid = openid || 'default';

  let goals = (db.data.goals || []).filter(g => g.openid === uid);
  if (start) goals = goals.filter(g => g.date >= start);
  if (end) goals = goals.filter(g => g.date <= end);

  // 按日期分组
  const map = {};
  for (const g of goals) {
    if (!map[g.date]) map[g.date] = { date: g.date, goals: [], total: 0, done: 0 };
    map[g.date].goals.push(g);
    map[g.date].total++;
    if (g.done) map[g.date].done++;
  }

  const days = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  res.json({ days });
});

// 获取统计
app.get('/api/goals/stats', (req, res) => {
  const openid = req.query.openid || 'default';
  const goals = (db.data.goals || []).filter(g => g.openid === openid);

  const days = new Set(goals.map(g => g.date));
  const totalGoals = goals.length;
  const doneGoals = goals.filter(g => g.done).length;

  // 连续天数
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = fmtDate(d);
    const dayGoals = goals.filter(g => g.date === dateStr);
    if (dayGoals.length > 0) {
      streak++;
    } else if (i === 0) {
      // 今天还没有目标，不中断
      continue;
    } else {
      break;
    }
  }

  res.json({
    streak,
    totalDays: days.size,
    totalGoals,
    doneGoals,
    completionRate: totalGoals > 0 ? Math.round((doneGoals / totalGoals) * 100) : 0,
  });
});

// ========== AI 提炼 ==========

app.post('/api/ai/refine', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: '文本不能为空' });

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个帮助用户提炼每日目标的助手。用户会用语音说一段话，描述今天想做的事情。
请从这段话中提炼出 1-5 条清晰、具体、可执行的目标。
每条目标要简短（不超过15个字），用动词开头。
如果用户说的内容中包含了不确定、非目标的内容（比如闲聊、感慨），忽略它们。

返回格式：纯 JSON 数组，不要有其他文字。
例如：["完成项目方案初稿","跑步30分钟","读20页书"]`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || '[]';
    // 安全解析
    let items = [];
    try {
      // 尝试直接解析
      items = JSON.parse(reply);
    } catch {
      // 尝试提取 JSON 数组
      const match = reply.match(/\[.*\]/s);
      if (match) items = JSON.parse(match[0]);
    }

    res.json({ items, raw: reply });
  } catch (err) {
    console.error('AI 提炼失败:', err.message);
    // 降级：返回原始文本作为一条目标
    res.json({ items: [text], raw: text });
  }
});

// ========== 用户提醒设置 ==========

app.get('/api/user/settings', (req, res) => {
  const openid = req.query.openid || 'default';
  const user = (db.data.users || []).find(u => u.openid === openid);
  res.json({
    settings: user?.settings || {
      morningReminder: true,
      morningTime: '08:00',
      eveningReminder: true,
      eveningTime: '21:00',
    },
  });
});

app.put('/api/user/settings', async (req, res) => {
  const { openid, settings } = req.body;
  const uid = openid || 'default';
  let user = (db.data.users || []).find(u => u.openid === uid);
  if (!user) {
    user = { openid: uid, settings };
    db.data.users.push(user);
  } else {
    user.settings = { ...user.settings, ...settings };
  }
  await db.write();
  res.json({ settings: user.settings });
});

// ============ 工具函数 ============

function today() {
  return fmtDate(new Date());
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ============ 启动 ============
const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`🚀 今日事今日毕 服务启动: http://0.0.0.0:${PORT}`);
});
