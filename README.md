# 🌸 Wiki Chan Bot

Bot Discord mini game, tiền tệ **Wiki Chan Coin (WCC)**. Một service Node.js chạy cả bot, API và trang web.

**Lệnh:** `/daily` · `/top` · `/balance` · `/tx` (tung xu, cooldown 5 giây)

## Chạy thử trên máy

```bash
npm install
cp .env.example .env     # rồi điền DISCORD_TOKEN, MONGODB_URI
npm start
```

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `DISCORD_TOKEN` | Token bot (Developer Portal → Bot → Reset Token) |
| `CLIENT_ID` | `1566673824563339266` |
| `MONGODB_URI` | `mongodb+srv://USER:PASS@cluster0.ekjov3s.mongodb.net/wikichan?retryWrites=true&w=majority` |
| `GUILD_ID` | (tùy chọn) ID server test để lệnh có hiệu lực ngay |

⚠️ Không commit file `.env`. Nếu mật khẩu có ký tự đặc biệt (`@ : / ?`), phải mã hóa bằng `encodeURIComponent`.

## Đưa lên GitHub

1. Tạo repo mới, ví dụ `wiki-chan-bot`.
2. Đưa **toàn bộ nội dung thư mục này** lên (kể cả `public/`), trừ `node_modules` và `.env`.

## Deploy lên Render (miễn phí)

1. Render → **New → Web Service** → chọn repo GitHub.
2. Cài đặt:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Thêm 3 biến môi trường ở mục **Environment**: `DISCORD_TOKEN`, `CLIENT_ID`, `MONGODB_URI`.
4. Bấm **Deploy**. Khi log hiện `Đã đăng nhập: ...` là bot online.

### Giữ bot không bị ngủ
Render free ngủ sau ~15 phút không có truy cập. Hãy tạo monitor miễn phí trên [UptimeRobot](https://uptimerobot.com):
- Type: HTTP(s)
- URL: `https://TEN-APP.onrender.com/health`
- Interval: 5 phút

## Cấu trúc

```
src/
├─ index.js              khởi động bot + web
├─ deploy-commands.js    đăng ký slash command (tự chạy khi khởi động)
├─ config.js             số tiền thưởng, màu, tên tiền
├─ database.js           kết nối MongoDB
├─ server.js             Express: /api/leaderboard, /health, trang web
├─ models/User.js
├─ commands/             mỗi lệnh một file (thả file mới vào là có lệnh mới)
├─ events/
└─ utils/
public/                  trang web đã build
```

## Thêm lệnh mới

Tạo file trong `src/commands/`, xuất ra `{ data, execute }` giống `daily.js`. Khởi động lại bot là lệnh tự được đăng ký.
