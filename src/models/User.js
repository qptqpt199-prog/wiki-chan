const mongoose = require('mongoose');

// Dữ liệu lưu theo userId (không theo server) nên tiền dùng chung liên server.
const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: 'Người chơi ẩn danh' },
    avatar: { type: String, default: '' },

    balance: { type: Number, default: 0, index: -1 }, // index giảm dần cho bảng xếp hạng
    totalEarned: { type: Number, default: 0 },

    lastDaily: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
