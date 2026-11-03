const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../models/User');
const { colors, currency } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription(`Xem số dư ${currency.name}`)
    .addUserOption((opt) =>
      opt.setName('nguoi_choi').setDescription('Người bạn muốn xem (bỏ trống để xem của mình)')
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('nguoi_choi') || interaction.user;

    if (target.bot) {
      return interaction.reply({ content: 'Bot thì không có ví đâu nha 🤖', flags: MessageFlags.Ephemeral });
    }

    // Chỉ ghi nhận người dùng khi xem ví của chính mình
    const data =
      target.id === interaction.user.id
        ? await getOrCreateUser(target)
        : await User.findOne({ userId: target.id });

    const balance = data ? data.balance : 0;
    const rank = data ? (await User.countDocuments({ balance: { $gt: balance } })) + 1 : null;

    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setAuthor({
        name: `Ví của ${target.globalName || target.username}`,
        iconURL: target.displayAvatarURL({ size: 64 }),
      })
      .setDescription(formatCoin(balance))
      .addFields({ name: 'Hạng', value: rank ? `#${rank}` : 'Chưa có', inline: true });

    return interaction.reply({ embeds: [embed] });
  },
};
