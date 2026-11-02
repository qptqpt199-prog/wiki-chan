const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { daily, colors, currency } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { formatCoin, formatDuration } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription(`Nhận ${currency.name} miễn phí mỗi ngày`),

  async execute(interaction) {
    const user = await getOrCreateUser(interaction.user);
    const now = Date.now();
    const last = user.lastDaily ? user.lastDaily.getTime() : null;

    // Chưa đủ 24 giờ
    if (last && now - last < daily.cooldownMs) {
      const remaining = daily.cooldownMs - (now - last);
      const embed = new EmbedBuilder()
        .setColor(colors.warning)
        .setTitle('⏳ Chưa đến giờ nhận thưởng')
        .setDescription(
          `Wiki Chan đã phát quà cho bạn rồi nè.\nHãy quay lại sau **${formatDuration(remaining)}** nhé!`
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Tính chuỗi ngày liên tiếp
    const keepStreak = last && now - last <= daily.streakExpireMs;
    const streak = keepStreak ? user.dailyStreak + 1 : 1;
    const streakDays = Math.min(streak, daily.maxStreakDays);
    const bonus = (streakDays - 1) * daily.streakBonus;
    const reward = daily.baseReward + bonus;

    // Cập nhật có điều kiện (chống bấm 2 lần cùng lúc)
    const updated = await User.findOneAndUpdate(
      { userId: user.userId, lastDaily: user.lastDaily },
      {
        $set: { lastDaily: new Date(now), dailyStreak: streak },
        $inc: { balance: reward, totalEarned: reward },
      },
      { new: true }
    );

    if (!updated) {
      return interaction.reply({
        content: 'Có gì đó chưa ổn, bạn thử lại sau vài giây nhé!',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(colors.primary)
      .setTitle('🎁 Quà hằng ngày từ Wiki Chan')
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(`Bạn nhận được ${formatCoin(reward)}!`)
      .addFields(
        { name: 'Thưởng cơ bản', value: formatCoin(daily.baseReward), inline: true },
        { name: 'Thưởng chuỗi', value: formatCoin(bonus), inline: true },
        { name: '🔥 Chuỗi ngày', value: `**${streak}** ngày`, inline: true },
        { name: 'Số dư hiện tại', value: formatCoin(updated.balance) }
      )
      .setFooter({ text: 'Quay lại sau 24 giờ để giữ chuỗi nhé!' });

    return interaction.reply({ embeds: [embed] });
  },
};
