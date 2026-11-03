const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Company = require('../models/Company');
const { colors, company: cfg } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin } = require('../utils/format');
const { checkCooldown } = require('../utils/cooldown'); // đổi lại nếu file cooldown của bạn tên khác
const { settleCompany, getOpenInfo, calcStats, dayKey, dayStart, DAY } = require('../utils/company');

const industryChoices = cfg.industries.map((i) => ({
  name: `${i.emoji} ${i.name} (vốn ${i.capital.toLocaleString('en-US')})`,
  value: i.key,
}));
const scaleChoices = cfg.scales.map((s) => ({ name: `${s.name} (×${s.multiplier} vốn)`, value: s.key }));
const unix = (d) => Math.floor(d.getTime() / 1000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kn')
    .setDescription('Khởi nghiệp, lập công ty để kiếm coin mỗi giờ')
    .addStringOption((o) =>
      o.setName('nganh').setDescription('Ngành chính').setRequired(true).addChoices(...industryChoices)
    )
    .addStringOption((o) =>
      o.setName('quy_mo').setDescription('Quy mô lúc khởi nghiệp').setRequired(true).addChoices(...scaleChoices)
    )
    .addStringOption((o) =>
      o
        .setName('nganh_phu')
        .setDescription('Ngành thứ 2 (đa ngành: doanh thu cao hơn nhưng tỉ lệ thất bại cao)')
        .addChoices(...industryChoices)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;

    const wait = checkCooldown('kn', userId, cfg.cooldownMs);
    if (wait > 0) return interaction.editReply(`Từ từ thôi! Chờ ${Math.ceil(wait / 1000)} giây nữa nhé ⏳`);

    // Xử lý bill/phá sản còn tồn trước
    await settleCompany(interaction.client, userId);

    const existing = await Company.findOne({ userId });
    if (existing && existing.status === 'active') {
      return interaction.editReply('Bạn đã có công ty rồi! Xem bằng `/xembillkn`, hoặc giải thể bằng `/gt` nếu muốn làm lại.');
    }
    if (existing && existing.status === 'bankrupt' && existing.bannedUntil && existing.bannedUntil > new Date()) {
      return interaction.editReply(
        `Công ty của bạn vừa phá sản 😢 Bạn bị cấm khởi nghiệp đến <t:${unix(existing.bannedUntil)}:F> (<t:${unix(existing.bannedUntil)}:R>).`
      );
    }

    const main = interaction.options.getString('nganh');
    const sub = interaction.options.getString('nganh_phu');
    const scaleKey = interaction.options.getString('quy_mo');
    if (sub && sub === main) return interaction.editReply('Ngành phụ phải khác ngành chính nhé.');

    const keys = sub ? [main, sub] : [main];
    const { inds, scale, cost, rate } = getOpenInfo(keys, scaleKey);
    const names = inds.map((i) => `${i.emoji} ${i.name}`).join(' + ');

    const user = await getOrCreateUser(interaction.user);
    if (user.balance < cost) {
      return interaction.editReply(
        `Mở **${names}** (${scale.name}) cần ${formatCoin(cost)}, ví bạn đang có ${formatCoin(user.balance)}.`
      );
    }

    // Trừ vốn nguyên tử, chỉ thành công khi đủ tiền
    const paid = await User.findOneAndUpdate(
      { userId, balance: { $gte: cost } },
      { $inc: { balance: -cost } },
      { new: true }
    );
    if (!paid) return interaction.editReply('Số dư không đủ để khởi nghiệp.');

    // Tung xúc xắc thành công/thất bại
    if (Math.random() >= rate) {
      const refund = Math.floor(cost * cfg.failRefundRate);
      await User.updateOne({ userId }, { $inc: { balance: refund } });
      const embed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('Khởi nghiệp thất bại 💔')
        .setDescription(
          `**${names}** (${scale.name}) không thành công (tỉ lệ thành công là ${Math.round(rate * 100)}%).\nBạn mất ${formatCoin(cost - refund)} và được hoàn lại ${formatCoin(refund)}.`
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // Thành công: xóa hồ sơ công ty cũ (đã đóng) rồi tạo mới
    await Company.deleteOne({ userId, status: { $ne: 'active' } });
    const now = new Date();
    let company;
    try {
      company = await Company.create({
        userId,
        industries: keys,
        scaleKey,
        scaleMultiplier: scale.multiplier,
        capital: cost,
        openedAt: now,
        accruedUntil: now,
        nextBillDay: dayKey(now.getTime()),
        upgradedDay: dayKey(now.getTime()),
      });
    } catch (err) {
      await User.updateOne({ userId }, { $inc: { balance: cost } });
      if (err.code === 11000) return interaction.editReply('Bạn đã có công ty rồi.');
      throw err;
    }

    const stats = calcStats(company);
    const firstBill = new Date(dayStart(company.nextBillDay) + DAY);
    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setTitle('Khởi nghiệp thành công 🎉')
      .setDescription(`Bạn đã mở **${names}** (${scale.name}) với vốn ${formatCoin(cost)}.`)
      .addFields(
        { name: 'Doanh thu ước tính', value: `${formatCoin(Math.round(stats.dailyRevenue))}/ngày`, inline: true },
        { name: 'Bill ước tính', value: `${formatCoin(Math.round(stats.dailyBill))}/ngày`, inline: true },
        { name: 'Bill đầu tiên', value: `<t:${unix(firstBill)}:R> (00:00 giờ Việt Nam)` },
        {
          name: 'Lưu ý',
          value:
            'Doanh thu cộng vào ví mỗi giờ. Bill trừ vào ví mỗi ngày. Hãy dùng `/nangcapkn` thường xuyên, nếu bỏ bê thì doanh thu giảm và bill tăng. Dùng `/xembillkn` để theo dõi.',
        }
      );
    return interaction.editReply({ embeds: [embed] });
  },
};
