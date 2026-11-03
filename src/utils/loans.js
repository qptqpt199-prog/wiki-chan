const Loan = require('../models/Loan');
const User = require('../models/User');
const { loan: cfg, colors } = require('../config');
const { EmbedBuilder } = require('discord.js');
const { formatCoin } = require('./format');

const HOUR_MS = 60 * 60 * 1000;

// Lãi tính theo số GIỜ TRỌN đã trôi qua, dừng lại ở hạn trả.
function calcInterest(loan, at = new Date()) {
  const end = Math.min(at.getTime(), loan.dueAt.getTime());
  const hours = Math.max(0, Math.floor((end - loan.borrowedAt.getTime()) / HOUR_MS));
  return Math.floor(((loan.principal * loan.dailyRate) / 100 / 24) * hours);
}

function calcOwed(loan, at = new Date()) {
  return Math.max(0, loan.principal + calcInterest(loan, at) - loan.repaid);
}

// Chuyển các khoản quá hạn thành nợ xấu: trừ thẳng vào ví (có thể âm).
async function settleOverdueLoans(client, userId = null) {
  const now = new Date();
  const filter = { status: 'active', dueAt: { $lte: now } };
  if (userId) filter.userId = userId;

  const loans = await Loan.find(filter);
  for (const loan of loans) {
    const owed = calcOwed(loan, loan.dueAt);

    // findOneAndUpdate có điều kiện status để tránh trừ tiền 2 lần
    const claimed = await Loan.findOneAndUpdate(
      { _id: loan._id, status: 'active' },
      { $set: { status: 'defaulted', settledAt: now, finalOwed: owed } }
    );
    if (!claimed) continue;

    if (owed > 0) {
      await User.updateOne({ userId: loan.userId }, { $inc: { balance: -owed } });
    }

    if (client) {
      try {
        const user = await client.users.fetch(loan.userId);
        const embed = new EmbedBuilder()
          .setColor(colors.error)
          .setTitle('Khoản vay đã quá hạn 😢')
          .setDescription(
            `Khoản vay ${formatCoin(loan.principal)} (${loan.termDays} ngày) chưa được trả nên Wiki Chan đã trừ ${formatCoin(owed)} vào ví của bạn. Ví có thể đang âm, bạn sẽ không vay được cho đến khi ví dương lại.`
          );
        await user.send({ embeds: [embed] });
      } catch {
        // người dùng đóng DM, bỏ qua
      }
    }
  }
}

let sweeping = false;
function startLoanSweeper(client) {
  const run = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await settleOverdueLoans(client);
    } catch (err) {
      console.error('[Vay] Lỗi khi quét khoản quá hạn:', err.message);
    } finally {
      sweeping = false;
    }
  };
  run(); // chạy ngay khi bật bot để xử lý khoản đáo hạn lúc bot tắt
  setInterval(run, cfg.sweepIntervalMs);
}

module.exports = { HOUR_MS, calcInterest, calcOwed, settleOverdueLoans, startLoanSweeper };
