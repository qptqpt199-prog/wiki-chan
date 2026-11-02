// Cấu hình chung của Wiki Chan. Chỉnh số liệu game tại đây.
module.exports = {
  currency: {
    name: 'Wiki Chan Coin',
    short: 'WCC',
    emoji: '🪙',
  },

  daily: {
    baseReward: 500, // thưởng cơ bản mỗi ngày
    streakBonus: 50, // cộng thêm cho mỗi ngày liên tiếp
    maxStreakDays: 7, // số ngày tối đa được cộng thưởng chuỗi
    cooldownMs: 24 * 60 * 60 * 1000, // 24 giờ
    streakExpireMs: 48 * 60 * 60 * 1000, // quá 48 giờ thì mất chuỗi
  },

  coinflip: {
    minBet: 1,
    cooldownMs: 5 * 1000, // 5 giây mỗi lượt để chống spam
    animationFrames: 5, // số khung hình "đang tung" (xấp/ngửa luân phiên)
    frameMs: 1000, // mỗi khung hình hiện 1 giây => tổng khoảng 5 giây
  },

  leaderboard: {
    size: 10,
    cacheMs: 30 * 1000, // cache API 30 giây
  },

  colors: {
    primary: 0xf9a8d4, // hồng pastel
    success: 0xc4b5fd, // tím pastel
    warning: 0xfcd34d,
    error: 0xfca5a5,
  },
};
