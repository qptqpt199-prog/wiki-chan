const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { leaderboard, colors, currency } = require('../config');
const { formatCoin, formatNumber } = require('../utils/format');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription(`Bảng xếp hạng ${leaderboard.size} người giàu nhất (liên server)`),

  async execute(interaction) {
    await interaction.deferReply();

    const top = await User.find({ balance: { $gt: 0 } })
      .sort({ balance: -1 })
      .limit(leaderboard.size)
      .lean();

    if (top.length === 0) {
      return interaction.editReply('Chưa có ai trong bảng xếp hạng. Hãy dùng `/daily` để là người đầu tiên nhé! ✨');
    }

    const lines = top.map((u, i) => {
      const medal = MEDALS[i] || `**${i + 1}.**`;
      return `${medal} **${u.username}** — ${currency.emoji} ${formatNumber(u.balance)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setTitle(`👑 Top ${leaderboard.size} người giàu nhất`)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Tính theo ${currency.name} • Liên server` });

    // Nếu người dùng nằm ngoài top, hiện thêm hạng của họ
    const inTop = top.some((u) => u.userId === interaction.user.id);
    if (!inTop) {
      const me = await User.findOne({ userId: interaction.user.id }).lean();
      if (me) {
        const rank = (await User.countDocuments({ balance: { $gt: me.balance } })) + 1;
        embed.addFields({
          name: 'Hạng của bạn',
          value: `#${rank} — ${formatCoin(me.balance)}`,
        });
      }
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
