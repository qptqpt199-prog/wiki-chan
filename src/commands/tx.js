const { randomInt } = require('node:crypto');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { coinflip, colors } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { checkCooldown } = require('../utils/cooldown');
const { formatCoin } = require('../utils/format');

const SIDES = {
  sap: { label: 'Xấp', emoji: '🔴' },
  ngua: { label: 'Ngửa', emoji: '🟡' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tx')
    .setDescription('Tung đồng xu: đoán đúng thắng gấp đôi, đoán sai mất tiền cược')
    .addStringOption((opt) =>
      opt
        .setName('lua_chon')
        .setDescription('Bạn đoán xấp hay ngửa?')
        .setRequired(true)
        .addChoices({ name: 'Xấp', value: 'sap' }, { name: 'Ngửa', value: 'ngua' })
    )
    .addIntegerOption((opt) =>
      opt
        .setName('so_tien')
        .setDescription('Số Wiki Chan Coin muốn cược')
        .setRequired(true)
        .setMinValue(coinflip.minBet)
    ),

  async execute(interaction) {
    // Chống spam: 5 giây mỗi lần
    const wait = checkCooldown('tx', interaction.user.id, coinflip.cooldownMs);
    if (wait > 0) {
      const embed = new EmbedBuilder()
        .setColor(colors.warning)
        .setDescription(`⏳ Từ từ thôi! Chờ **${Math.ceil(wait / 1000)} giây** nữa rồi tung tiếp nhé.`);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const choice = interaction.options.getString('lua_chon');
    const bet = interaction.options.getInteger('so_tien');

    const user = await getOrCreateUser(interaction.user);

    if (user.balance < bet) {
      const embed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('💸 Không đủ tiền')
        .setDescription(
          `Bạn chỉ có ${formatCoin(user.balance)} mà muốn cược ${formatCoin(bet)}.\nDùng \`/daily\` để nhận thêm coin nhé!`
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Tung xu 50/50 bằng bộ sinh số ngẫu nhiên an toàn
    const result = randomInt(2) === 0 ? 'sap' : 'ngua';
    const won = result === choice;

    // Một thao tác duy nhất, có điều kiện đủ tiền: không thể cược quá số dư dù bấm liên tục
    const updated = await User.findOneAndUpdate(
      { userId: user.userId, balance: { $gte: bet } },
      { $inc: { balance: won ? bet : -bet, totalEarned: won ? bet : 0 } },
      { new: true }
    );

    if (!updated) {
      return interaction.reply({ content: 'Số dư của bạn vừa thay đổi, hãy thử lại nhé!', ephemeral: true });
    }

    const picked = SIDES[choice];
    const landed = SIDES[result];

    const embed = new EmbedBuilder()
      .setColor(won ? colors.success : colors.error)
      .setAuthor({
        name: interaction.user.globalName || interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ size: 64 }),
      })
      .setTitle(won ? '🎉 Bạn thắng rồi!' : '😢 Bạn thua mất rồi...')
      .setDescription(
        `Đồng xu rơi ra **${landed.emoji} ${landed.label}**\n` +
          (won
            ? `Bạn đoán đúng và nhận được ${formatCoin(bet * 2)} (lãi ${formatCoin(bet)})`
            : `Bạn đoán **${picked.label}** nên mất ${formatCoin(bet)}`)
      )
      .addFields(
        { name: 'Bạn chọn', value: `${picked.emoji} ${picked.label}`, inline: true },
        { name: 'Tiền cược', value: formatCoin(bet), inline: true },
        { name: 'Số dư hiện tại', value: formatCoin(updated.balance) }
      )
      .setFooter({ text: 'Cooldown 5 giây mỗi lượt' });

    return interaction.reply({ embeds: [embed] });
  },
};
