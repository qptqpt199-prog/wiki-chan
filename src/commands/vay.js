const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../models/User');
const Loan = require('../models/Loan');
const { colors, loan: cfg } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin } = require('../utils/format');
const { checkCooldown } = require('../utils/cooldown'); // đổi lại nếu file cooldown của bạn tên khác
const { HOUR_MS, calcInterest, calcOwed, settleOverdueLoans } = require('../utils/loans');

const vnFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});
const fmtVN = (d) => `${vnFormatter.format(d)} (GMT+7)`;
const unix = (d) => Math.floor(d.getTime() / 1000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vay')
    .setDescription('Vay coin để chơi game')
    .addSubcommand((sub) =>
      sub
        .setName('moi')
        .setDescription('Tạo khoản vay mới')
        .addIntegerOption((o) =>
          o
            .setName('so_tien')
            .setDescription(`Số tiền vay (${cfg.minAmount} - ${cfg.maxTotal})`)
            .setRequired(true)
            .setMinValue(cfg.minAmount)
            .setMaxValue(cfg.maxTotal)
        )
        .addIntegerOption((o) =>
          o
            .setName('ky_han')
            .setDescription('Kỳ hạn trả nợ')
            .setRequired(true)
            .addChoices(
              ...cfg.terms.map((t) => ({
                name: `${t.days} ngày - lãi ${t.dailyRate}%/ngày`,
                value: t.days,
              }))
            )
        )
    )
    .addSubcommand((sub) => sub.setName('xem').setDescription('Xem các khoản đang vay'))
    .addSubcommand((sub) =>
      sub
        .setName('tra')
        .setDescription('Trả nợ (bỏ trống số tiền để trả hết)')
        .addIntegerOption((o) =>
          o.setName('so_tien').setDescription('Số tiền muốn trả').setMinValue(1)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply(sub === 'xem' ? { flags: MessageFlags.Ephemeral } : {});

    // Xử lý khoản quá hạn của người này trước khi làm gì khác
    await settleOverdueLoans(interaction.client, interaction.user.id);

    if (sub === 'moi') return borrow(interaction);
    if (sub === 'tra') return repay(interaction);
    return view(interaction);
  },
};

async function borrow(interaction) {
  const userId = interaction.user.id;
  const amount = interaction.options.getInteger('so_tien');
  const days = interaction.options.getInteger('ky_han');
  const term = cfg.terms.find((t) => t.days === days);
  if (!term) return interaction.editReply('Kỳ hạn không hợp lệ.');

  const wait = checkCooldown('vay', userId, cfg.cooldownMs);
  if (wait > 0) return interaction.editReply(`Từ từ thôi! Chờ ${Math.ceil(wait / 1000)} giây nữa nhé ⏳`);

  const user = await getOrCreateUser(interaction.user);
  if (user.balance < 0) {
    return interaction.editReply(
      `Ví của bạn đang âm (${formatCoin(user.balance)}) nên không thể vay thêm. Hãy kiếm coin để ví dương lại nhé!`
    );
  }

  const active = await Loan.find({ userId, status: 'active' }).select('principal');
  const currentPrincipal = active.reduce((sum, l) => sum + l.principal, 0);
  if (currentPrincipal + amount > cfg.maxTotal) {
    const left = Math.max(0, cfg.maxTotal - currentPrincipal);
    return interaction.editReply(
      `Tổng tiền vay không được quá ${formatCoin(cfg.maxTotal)}. Bạn đang vay ${formatCoin(currentPrincipal)}, chỉ còn vay được tối đa ${formatCoin(left)}.`
    );
  }

  const borrowedAt = new Date();
  const dueAt = new Date(borrowedAt.getTime() + days * 24 * HOUR_MS);
  const loan = await Loan.create({
    userId,
    principal: amount,
    termDays: days,
    dailyRate: term.dailyRate,
    borrowedAt,
    dueAt,
  });

  try {
    await User.updateOne({ userId }, { $inc: { balance: amount } });
  } catch (err) {
    await Loan.deleteOne({ _id: loan._id });
    throw err;
  }

  const fullInterest = calcInterest(loan, dueAt);
  const embed = new EmbedBuilder()
    .setColor(colors.success)
    .setTitle('Vay thành công 💸')
    .setDescription(`Bạn đã nhận ${formatCoin(amount)}. Nhớ trả đúng hạn nhé!`)
    .addFields(
      { name: 'Kỳ hạn', value: `${days} ngày`, inline: true },
      { name: 'Lãi suất', value: `${term.dailyRate}%/ngày (tính theo giờ)`, inline: true },
      { name: 'Hạn trả', value: `${fmtVN(dueAt)}\n<t:${unix(dueAt)}:R>` },
      { name: 'Nếu trả đúng hạn chót', value: formatCoin(amount + fullInterest) },
      {
        name: 'Lưu ý',
        value: 'Quá hạn mà chưa trả, Wiki Chan sẽ tự trừ nợ vào ví, ví có thể bị âm và bạn sẽ không vay được nữa.',
      }
    );
  return interaction.editReply({ embeds: [embed] });
}

async function view(interaction) {
  const userId = interaction.user.id;
  const loans = await Loan.find({ userId, status: 'active' }).sort({ dueAt: 1 });
  const user = await getOrCreateUser(interaction.user);

  if (!loans.length) {
    return interaction.editReply(
      `Bạn không có khoản vay nào 🎉 Bạn có thể vay tối đa ${formatCoin(cfg.maxTotal)}. Dùng \`/vay moi\` để vay.`
    );
  }

  const now = new Date();
  let totalOwed = 0;
  let totalPrincipal = 0;
  const lines = loans.map((l) => {
    const interest = calcInterest(l, now);
    const owed = calcOwed(l, now);
    totalOwed += owed;
    totalPrincipal += l.principal;
    return (
      `**#${String(l._id).slice(-6)}** · Vay ${formatCoin(l.principal)} · ${l.termDays} ngày (${l.dailyRate}%/ngày)\n` +
      `Lãi hiện tại: ${formatCoin(interest)} · Đã trả: ${formatCoin(l.repaid)} · **Còn nợ: ${formatCoin(owed)}**\n` +
      `Hạn: ${fmtVN(l.dueAt)} (<t:${unix(l.dueAt)}:R>)`
    );
  });

  const shown = lines.slice(0, 10);
  if (lines.length > 10) shown.push(`...và ${lines.length - 10} khoản khác`);

  const embed = new EmbedBuilder()
    .setColor(colors.warning)
    .setTitle('Các khoản vay của bạn')
    .setDescription(shown.join('\n\n'))
    .addFields(
      { name: 'Tổng còn nợ', value: formatCoin(totalOwed), inline: true },
      { name: 'Ví hiện tại', value: formatCoin(user.balance), inline: true },
      { name: 'Còn vay thêm được', value: formatCoin(Math.max(0, cfg.maxTotal - totalPrincipal)), inline: true }
    );
  return interaction.editReply({ embeds: [embed] });
}

async function repay(interaction) {
  const userId = interaction.user.id;

  const wait = checkCooldown('vay-tra', userId, 3000);
  if (wait > 0) return interaction.editReply(`Từ từ thôi! Chờ ${Math.ceil(wait / 1000)} giây nữa nhé ⏳`);

  const loans = await Loan.find({ userId, status: 'active' }).sort({ dueAt: 1 });
  if (!loans.length) return interaction.editReply('Bạn không có khoản vay nào cần trả 🎉');

  const now = new Date();
  const rows = loans.map((loan) => ({ loan, owed: calcOwed(loan, now) }));
  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);

  const input = interaction.options.getInteger('so_tien');
  const amount = Math.min(input ?? totalOwed, totalOwed);
  if (amount <= 0) return interaction.editReply('Số tiền trả không hợp lệ.');

  // Trừ ví nguyên tử, chỉ thành công khi đủ tiền
  const paidUser = await User.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!paidUser) {
    const u = await getOrCreateUser(interaction.user);
    return interaction.editReply(
      `Bạn không đủ coin để trả ${formatCoin(amount)}. Ví hiện có ${formatCoin(u.balance)}. Bạn có thể dùng \`/vay tra so_tien:...\` để trả một phần.`
    );
  }

  let left = amount;
  let applied = 0;
  let cleared = 0;
  for (const { loan, owed } of rows) {
    if (left <= 0) break;
    const pay = Math.min(left, owed);
    if (pay <= 0) continue;

    const fullyPaid = pay >= owed;
    const update = { $inc: { repaid: pay } };
    if (fullyPaid) update.$set = { status: 'repaid', settledAt: now };

    const res = await Loan.updateOne({ _id: loan._id, status: 'active' }, update);
    if (res.modifiedCount === 0) continue; // khoản này vừa bị chuyển sang quá hạn, không trừ

    left -= pay;
    applied += pay;
    if (fullyPaid) cleared++;
  }

  // Hoàn lại phần chưa áp dụng được (nếu có)
  if (left > 0) await User.updateOne({ userId }, { $inc: { balance: left } });

  const remaining = totalOwed - applied;
  const embed = new EmbedBuilder()
    .setColor(colors.success)
    .setTitle('Trả nợ thành công ✅')
    .setDescription(`Bạn đã trả ${formatCoin(applied)}${cleared ? `, tất toán ${cleared} khoản vay` : ''}.`)
    .addFields({ name: 'Còn nợ', value: formatCoin(Math.max(0, remaining)), inline: true });
  return interaction.editReply({ embeds: [embed] });
}
