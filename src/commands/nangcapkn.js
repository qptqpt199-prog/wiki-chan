const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Company = require('../models/Company');
const { colors, company: cfg } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin } = require('../utils/format');
const { checkCooldown } = require('../utils/cooldown');
const { settleCompany, levelOf, upgradeCost, calcStats, dayKey } = require('../utils/company');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nangcapkn')
    .setDescription('Nâng cấp công ty của bạn')
    .addStringOption((o) =>
      o
        .setName('thuoc_tinh')
        .setDescription('Thuộc tính cần nâng cấp')
        .setRequired(true)
        .addChoices(...cfg.upgrades.map((u) => ({ name: `${u.emoji} ${u.name}`, value: u.key })))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;

    const wait = checkCooldown('nangcapkn', userId, cfg.cooldownMs);
    if (wait > 0) return interaction.editReply(`Từ từ thôi! Chờ ${Math.ceil(wait / 1000)} giây nữa nhé ⏳`);

    // Tính doanh thu/bill đến hiện tại trước khi đổi chỉ số
    await settleCompany(interaction.client, userId);

    const key = interaction.options.getString('thuoc_tinh');
    const up = cfg.upgrades.find((u) => u.key === key);
    if (!up) return interaction.editReply('Thuộc tính không hợp lệ.');

    const company = await Company.findOne({ userId, status: 'active' });
    if (!company) return interaction.editReply('Bạn chưa có công ty. Dùng `/kn` để khởi nghiệp nhé!');

    const level = levelOf(company, key);
    if (level >= cfg.maxLevel) {
      return interaction.editReply(`${up.emoji} ${up.name} đã đạt cấp tối đa (${cfg.maxLevel}) rồi!`);
    }

    const cost = upgradeCost(company, level);
    const paid = await User.findOneAndUpdate(
      { userId, balance: { $gte: cost } },
      { $inc: { balance: -cost } },
      { new: true }
    );
    if (!paid) {
      const u = await getOrCreateUser(interaction.user);
      return interaction.editReply(
        `Nâng ${up.emoji} ${up.name} lên cấp ${level + 1} cần ${formatCoin(cost)}, ví bạn đang có ${formatCoin(u.balance)}.`
      );
    }

    const field = `levels.${key}`;
    const res = await Company.updateOne(
      { _id: company._id, status: 'active', [field]: level === 0 ? { $in: [0, null] } : level },
      { $set: { [field]: level + 1, upgradedDay: dayKey(Date.now()), idleDays: 0 } }
    );
    if (res.modifiedCount === 0) {
      await User.updateOne({ userId }, { $inc: { balance: cost } }); // hoàn tiền
      return interaction.editReply('Công ty vừa thay đổi, bạn thử lại nhé.');
    }

    const fresh = await Company.findById(company._id);
    const stats = calcStats(fresh);
    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setTitle(`Nâng cấp ${up.emoji} ${up.name} thành công ⬆️`)
      .setDescription(`Cấp ${level} → **${level + 1}/${cfg.maxLevel}** (tốn ${formatCoin(cost)}).\n${up.desc}`)
      .addFields(
        { name: 'Doanh thu', value: `${formatCoin(Math.round(stats.dailyRevenue))}/ngày`, inline: true },
        { name: 'Bill', value: `${formatCoin(Math.round(stats.dailyBill))}/ngày`, inline: true }
      )
      .setFooter({ text: 'Áp lực cạnh tranh đã được đặt lại về 0' });
    return interaction.editReply({ embeds: [embed] });
  },
};
