const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  principal: { type: Number, required: true }, // tiền gốc
  termDays: { type: Number, required: true },
  dailyRate: { type: Number, required: true }, // % mỗi ngày, lưu cố định lúc vay
  borrowedAt: { type: Date, required: true },
  dueAt: { type: Date, required: true },
  repaid: { type: Number, default: 0 }, // đã trả
  status: { type: String, enum: ['active', 'repaid', 'defaulted'], default: 'active' },
  settledAt: { type: Date, default: null },
  finalOwed: { type: Number, default: 0 }, // số nợ bị trừ khi quá hạn
});

loanSchema.index({ userId: 1, status: 1 });
loanSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.model('Loan', loanSchema);
