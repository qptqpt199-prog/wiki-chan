const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Company = require('../models/Company');
const { colors, company: cfg } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin } = require('../utils/format');
const {
  settleCompany,
  levelOf,
  upgradeCost,
  calcStats,
  billLine,
  industryMap,
  scaleMap,
  dayStart,
  DAY,
} = require('../utils/company');

const unix = (ms) => Math.floor(ms / 1000);

module.exports = {
  data: new SlashCommandBuilder().setName('xembillkn').setDescription('Xem công ty, doanh thu và bill của bạn'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;

    await settleCompany(interaction.client, userId);
    const c = await Company.findOne({ userId });
    const user = await getOrCreateUser(interaction.user);

    if (!c) return interaction.editReply('Bạn chưa có công ty. Dùng `/kn` để khởi nghiệp nhé!');

    if (c.status !== 'active') {
      const lines = [c.status === 'bankrupt' ? 'Công ty của bạn đã **phá sản** 💥' : 'Bạn đã **giải thể** công ty.'];
      if (c.bannedUntil && c.bannedUntil > new Date()) {
        lines.push(`Cấm khởi nghiệp đến <t:${unix(c.bannedUntil.getTime())}:F>.`);
      } else {
        lines.push('Bạn có thể khởi nghiệp lại bằng `/kn`.');
      }
      const embed = new EmbedBuilder().setColor(colors.error).setDescription(lines.join('\n'));
      if (c.history.length) embed.addFields({ name: 'Bill gần nhất', value: c.history.slice(-5).map(billLine).join('\n') });
      return interaction.editReply({ embeds: [embed] });
    }

    const stats = calcStats(c);
    const names = c.industries
      .map((k) => industryMap.get(k))
      .filter(Boolean)
      .map((i) => `${i.emoji} ${i.name}`)
      .join(' + ');
    const scaleName = (scaleMap.get(c.scaleKey) || {}).name || 'Doanh nghiệp';
    const nextBill = dayStart(c.nextBillDay) + DAY;

    const upgradeLines = cfg.upgrades.map((u) => {
      const l = levelOf(c, u.key);
      const tail = l >= cfg.maxLevel ? 'tối đa' : `nâng tiếp: ${upgradeCost(c, l).toLocaleString('vi-VN')}`;
      return `${u.emoji} **${u.name}** ${l}/${cfg.maxLevel} (${tail})`;
    });

    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setAuthor({
        name: `Công ty của ${interaction.user.globalName || interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL({ size: 64 }),
      })
      .setTitle(`${names} · ${scaleName}`)
      .addFields(
        { name: 'Vốn', value: formatCoin(c.capital), inline: true },
        {
          name: 'Doanh thu',
          value: `${formatCoin(Math.round(stats.hourlyRevenue))}/giờ\n(${formatCoin(Math.round(stats.dailyRevenue))}/ngày)`,
          inline: true,
        },
        { name: 'Bill ước tính', value: `${formatCoin(Math.round(stats.dailyBill))}/ngày`, inline: true },
        { name: 'Doanh thu hôm nay', value: formatCoin(c.dayRevenue || 0), inline: true },
        { name: 'Bill tiếp theo', value: `<t:${unix(nextBill)}:R>\n(00:00 giờ Việt Nam)`, inline: true },
        { name: 'Ví hiện tại', value: formatCoin(user.balance), inline: true },
        {
          name: `Áp lực cạnh tranh: ${Math.round(stats.pressure * 100)}%`,
          value: c.idleDays
            ? `Bạn đã ${c.idleDays} ngày không nâng cấp, doanh thu giảm và bill tăng.`
            : 'Bạn đang nâng cấp đều, chưa bị áp lực.',
        },
        { name: 'Nâng cấp (dùng /nangcapkn)', value: upgradeLines.join('\n') }
      )
      .setFooter({ text: `Phá sản khi ví ≤ ${cfg.bankruptcyLimit.toLocaleString('vi-VN')}` });

    if (c.history.length) {
      embed.addFields({ name: 'Bill gần nhất', value: c.history.slice(-5).map(billLine).join('\n') });
    }
    return interaction.editReply({ embeds: [embed] });
  },
};
