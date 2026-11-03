const mongoose = require('mongoose');
const { company: cfg } = require('../config');

const historySchema = new mongoose.Schema(
  {
    day: String, // YYYY-MM-DD theo giờ Việt Nam
    revenue: Number,
    expenses: Number,
    eventName: { type: String, default: '' },
    eventDelta: { type: Number, default: 0 }, // dương = thưởng, âm = thiệt hại
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    industries: { type: [String], required: true },
    scaleKey: { type: String, required: true },
    scaleMultiplier: { type: Number, required: true },
    capital: { type: Number, required: true },

    levels: {
      type: mongoose.Schema.Types.Mixed,
      default: () => Object.fromEntries(cfg.upgrades.map((u) => [u.key, 0])),
    },

    status: { type: String, enum: ['active', 'bankrupt', 'dissolved'], default: 'active' },
    openedAt: { type: Date, required: true },
    accruedUntil: { type: Date, required: true }, // doanh thu đã cộng vào ví đến mốc này
    nextBillDay: { type: String, required: true }, // ngày (VN) sẽ chốt bill tiếp theo
    upgradedDay: { type: String, default: '' },
    idleDays: { type: Number, default: 0 }, // số ngày liên tiếp không nâng cấp

    dayRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    warnLevel: { type: Number, default: 0 },
    history: { type: [historySchema], default: [] },

    closedAt: { type: Date, default: null },
    bannedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

companySchema.index({ status: 1 });

module.exports = mongoose.model('Company', companySchema);
