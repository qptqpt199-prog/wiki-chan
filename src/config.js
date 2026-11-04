// Cấu hình chung của Wiki Chan. Chỉnh số liệu game tại đây.
module.exports = {
  currency: {
    name: 'Wiki Chan Coin',
    short: 'WCC',
    emoji: '🪙',
  },

    loan: {
    minAmount: 100,
    maxTotal: 5000, // tổng tiền gốc đang vay tối đa
    cooldownMs: 5 * 1000,
    // dailyRate = % lãi mỗi NGÀY (tính dồn theo giờ: dailyRate / 24 mỗi giờ)
    terms: [
      { days: 5, dailyRate: 25 },
      { days: 10, dailyRate: 10 },
      { days: 30, dailyRate: 5 },
    ],
    sweepIntervalMs: 60 * 1000, // quét khoản quá hạn mỗi 60 giây
  },

    company: {
    cooldownMs: 5 * 1000,
    maxLevel: 200,
    bankruptcyLimit: -50000, // ví cá nhân <= mức này thì phá sản
    warnLevels: [-10000, -25000], // DM cảnh báo khi ví chạm các mức này
    bankruptBanDays: 3,
    resetWalletTo: 0, // phá sản: ví đang âm được xóa nợ về mức này
    failRefundRate: 0.3, // khởi nghiệp thất bại: hoàn lại 30% vốn
    historyDays: 14, // số bill lưu lại để xem
    maxCatchUpDays: 60, // số ngày bill tối đa xử lý mỗi lượt khi bot tắt lâu
    sweepIntervalMs: 60 * 1000,

    multiIndustry: { successMult: 0.8, revenueMult: 1.1, eventRiskMult: 0.8 },

    // Áp lực cạnh tranh: mỗi ngày không nâng cấp
    pressure: { perIdleDay: 0.02, max: 0.8 },

    // Chi phí nâng cấp = vốn * basePct * growth^cấp_hiện_tại (tối thiểu min)
    upgradeCost: { basePct: 0.015, growth: 1.5, min: 200 },

    scales: [
      { key: 'micro', name: 'Doanh nghiệp siêu nhỏ', multiplier: 1 },
      { key: 'small', name: 'Doanh nghiệp nhỏ', multiplier: 2 },
      { key: 'medium', name: 'Doanh nghiệp vừa', multiplier: 3 },
      { key: 'large', name: 'Doanh nghiệp lớn', multiplier: 5 },
    ],

    // revenueRate/billRate = % vốn mỗi NGÀY. volatility = xác suất có sự kiện mỗi ngày.
    industries: [
      { key: 'anvat', emoji: '🍢', name: 'Ăn vặt', capital: 5000, revenueRate: 0.045, billRate: 0.015, successRate: 0.9, volatility: 0.15 },
      { key: 'cafe', emoji: '☕', name: 'Cafe', capital: 10000, revenueRate: 0.05, billRate: 0.02, successRate: 0.85, volatility: 0.2 },
      { key: 'thoitrang', emoji: '👗', name: 'Thời trang', capital: 15000, revenueRate: 0.06, billRate: 0.025, successRate: 0.8, volatility: 0.3 },
      { key: 'vantai', emoji: '🚚', name: 'Vận tải', capital: 20000, revenueRate: 0.055, billRate: 0.02, successRate: 0.85, volatility: 0.3 },
      { key: 'congnghe', emoji: '💻', name: 'Công nghệ', capital: 20000, revenueRate: 0.08, billRate: 0.035, successRate: 0.7, volatility: 0.45 },
    ],

    // Muốn thêm thuộc tính mới: thêm 1 dòng vào đây (và thêm vào lệnh sẽ tự có lựa chọn).
    // revenuePerLevel / billPerLevel: cộng dồn theo cấp
    // shieldPerLevel: giảm áp lực cạnh tranh | riskPerLevel: giảm xác suất sự kiện xấu
    // decayEvery: cứ mỗi N ngày bỏ bê thì tụt 1 cấp (bỏ trống = không tụt)
    upgrades: [
      { key: 'scale', emoji: '🏢', name: 'Quy mô', desc: '+8% doanh thu, +5% bill mỗi cấp', revenuePerLevel: 0.08, billPerLevel: 0.05 },
      { key: 'quality', emoji: '⭐', name: 'Chất lượng', desc: '+6% doanh thu, +2% bill mỗi cấp. Tụt 1 cấp / 5 ngày bỏ bê', revenuePerLevel: 0.06, billPerLevel: 0.02, decayEvery: 5 },
      { key: 'ads', emoji: '📣', name: 'Quảng cáo', desc: '+5% doanh thu mỗi cấp. Tụt 1 cấp / 2 ngày bỏ bê', revenuePerLevel: 0.05, decayEvery: 2 },
      { key: 'competition', emoji: '🛡️', name: 'Cạnh tranh', desc: 'Giảm 9% áp lực đối thủ mỗi cấp', shieldPerLevel: 0.09 },
      { key: 'partnership', emoji: '🤝', name: 'Hợp tác', desc: '-4% bill, -5% rủi ro sự kiện xấu mỗi cấp. Tụt 1 cấp / 5 ngày bỏ bê', billPerLevel: -0.04, riskPerLevel: 0.05, decayEvery: 5 },
      { key: 'Supplier', emoji: '🚚', name: 'Nhà cung cấp', desc: '+1% doanh thu, -5% bill mỗi cấp', revenuePerLevel: 0.01, billPerLevel: -0.05 },
    ],

    // base: tính theo doanh thu ngày hoặc bill ngày. pct: tỉ lệ.
    events: [
      { key: 'viral', kind: 'good', name: 'Video quảng cáo bùng nổ 🔥', base: 'revenue', pct: 0.6 },
      { key: 'kol_endorse', kind: 'good', name: 'Người nổi tiếng đánh giá sản phẩm 🌟', base: 'revenue', pct: 0.35 },
      { key: 'organic_trend', kind: 'good', name: 'Lọt xu hướng tìm kiếm tự nhiên 📈', base: 'revenue', pct: 0.20 },
      { key: 'bigorder', kind: 'good', name: 'Có đơn hàng lớn 📦', base: 'revenue', pct: 0.4 },
      { key: 'inspection', kind: 'bad', name: 'Bị đoàn kiểm tra phạt 🚨', base: 'bill', pct: 0.5 },
      { key: 'competitor', kind: 'bad', name: 'Đối thủ khai trương gần đó 🏪', base: 'revenue', pct: 0.4 },
      { key: 'supply', kind: 'bad', name: 'Đứt chuỗi cung ứng 🚧', base: 'bill', pct: 0.3 },
      { key: 'server_crash', kind: 'bad', name: 'Sập hệ thống giờ cao điểm 📉', base: 'revenue', pct: 0.40 },
      { key: 'ad_policy_ban', kind: 'bad', name: 'Tài khoản quảng cáo bị khóa tạm thời 🚫', base: 'revenue', pct: 0.25 },
      { key: 'competitor_price_war', kind: 'bad', name: 'Đối thủ cạnh tranh phá giá thị trường ⚔️', base: 'revenue', pct: 0.15 },
      { key: 'shipping_delay', kind: 'bad', name: 'Khủng hoảng logistics, giao hàng trễ 📦', base: 'revenue', pct: 0.10 },
      { key: 'bad_review_storm', kind: 'bad', name: 'Bão đánh giá 1 sao từ đối thủ 💔', base: 'revenue', pct: 0.30 }
    ],
  },
  
  daily: {
    baseReward: 500, // thưởng cơ bản mỗi ngày
    streakBonus: 50, // cộng thêm cho mỗi ngày liên tiếp
    maxStreakDays: 7, // số ngày tối đa được cộng thưởng chuỗi
    cooldownMs: 24 * 60 * 60 * 1000, // 24 giờ
    streakExpireMs: 48 * 60 * 60 * 1000, // quá 48 giờ thì mất chuỗi
  },

  coinflip: {
    minBet: 100,
    cooldownMs: 5 * 1000, // 5 giây mỗi lượt để chống spam
    animationFrames: 5, // số khung hình "đang tung" (xấp/ngửa luân phiên)
    frameMs: 1000, // mỗi khung hình hiện 1 giây => tổng khoảng 5 giây
  },

  quaySo: {
    minBet: 100,
    cooldownMs: 5 * 1000,
    animationFrames: 5,
    frameMs: 1000,
    // chance = % ra bộ 3 giống nhau. Phần còn lại (100 - tổng) là thua.
    // multiplier = hệ số nhân trên tiền cược (1 = hoàn tiền cược)
    tiers: [
      { key: 'blue', emoji: '🔵', name: 'Xanh biển', multiplier: 1, chance: 20 },
      { key: 'black', emoji: '⚫', name: 'Đen', multiplier: 2, chance: 14 },
      { key: 'red', emoji: '🔴', name: 'Đỏ', multiplier: 4, chance: 7 },
    ],
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
