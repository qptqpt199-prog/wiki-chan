const path = require('node:path');
const express = require('express');
const User = require('./models/User');
const { leaderboard } = require('./config');

let cache = { at: 0, data: null };

function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.disable('x-powered-by');

  // Dùng để UptimeRobot ping, giữ bot không bị ngủ
  app.get('/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

  // Top 10 người giàu nhất, liên server
  app.get('/api/leaderboard', async (_req, res) => {
    try {
      if (cache.data && Date.now() - cache.at < leaderboard.cacheMs) {
        return res.json(cache.data);
      }

      const [rows, totalPlayers] = await Promise.all([
        User.find({ balance: { $gt: 0 } })
          .sort({ balance: -1 })
          .limit(leaderboard.size)
          .select('username avatar balance -_id')
          .lean(),
        User.countDocuments(),
      ]);

      const data = {
        updatedAt: new Date().toISOString(),
        totalPlayers,
        users: rows.map((u, i) => ({
          rank: i + 1,
          username: u.username,
          avatar: u.avatar,
          balance: u.balance,
        })),
      };

      cache = { at: Date.now(), data };
      res.json(data);
    } catch (err) {
      console.error('[API] /api/leaderboard lỗi:', err.message);
      res.status(500).json({ error: 'Không thể tải bảng xếp hạng' });
    }
  });

  // Trang web (bản build của React)
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

  app.listen(port, () => console.log(`[Web] Đang chạy ở cổng ${port}`));

  // Render tự cấp RENDER_EXTERNAL_URL: tự ping mỗi 10 phút để hạn chế ngủ.
  // Vẫn nên dùng thêm UptimeRobot để chắc chắn hơn.
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      fetch(`${selfUrl}/health`).catch(() => {});
    }, 10 * 60 * 1000);
  }
}

module.exports = { startServer };
