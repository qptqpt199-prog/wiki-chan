const { randomInt } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
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

/** Khung hình "đang tung": hiện mặt xu đang xoay */
function spinningEmbed(user, frame, choice, bet) {
  const face = frame % 2 === 0 ? SIDES.sap : SIDES.ngua;
  const dots = '.'.repeat((frame % 3) + 1);

  return new EmbedBuilder()
    .setColor(colors.warning)
    .setAuthor({
      name: user.globalName || user.username,
      iconURL: user.displayAvatarURL({ size: 64 }),
    })
    .setTitle(`🪙 Đang tung đồng xu${dots}`)
    .setDescription(`## ${face.emoji}  ${face.label.toUpperCase()}  ${face.emoji}\n*Đồng xu đang xoay trên không...*`)
    .addFields(
      { name: 'Bạn chọn', value: `${SIDES[choice].emoji} ${SIDES[choice].label}`, inline: true },
      { name: 'Tiền cược', value: formatCoin(bet), inline: true }
    )
    .setFooter({ text: 'Hồi hộp chưa nè...' });
}

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
    // Cooldown luôn dài hơn hoạt ảnh để không thể chồng 2 lượt tung cùng lúc
    const lockMs = Math.max(coinflip.cooldownMs, coinflip.animationFrames * coinflip.frameMs + 500);
    const wait = checkCooldown('tx', interaction.user.id, lockMs);
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

    // Bước 1: trừ tiền cược ngay (một thao tác, có điều kiện đủ số dư)
    const held = await User.findOneAndUpdate(
      { userId: user.userId, balance: { $gte: bet } },
      { $inc: { balance: -bet } },
      { new: true }
    );

    if (!held) {
      return interaction.reply({ content: 'Số dư của bạn vừa thay đổi, hãy thử lại nhé!', ephemeral: true });
    }

    // Kết quả được quyết định ngay (ngẫu nhiên an toàn) nhưng chỉ công bố sau hoạt ảnh
    const result = randomInt(2) === 0 ? 'sap' : 'ngua';
    const won = result === choice;

    // Bước 2: hoạt ảnh, sửa tin nhắn liên tục giữa xấp và ngửa
    await interaction.reply({ embeds: [spinningEmbed(interaction.user, 0, choice, bet)] });

    for (let frame = 1; frame < coinflip.animationFrames; frame++) {
      await sleep(coinflip.frameMs);
      try {
        await interaction.editReply({ embeds: [spinningEmbed(interaction.user, frame, choice, bet)] });
      } catch (err) {
        console.warn('[/tx] Không sửa được khung hình:', err.message);
      }
    }
    await sleep(coinflip.frameMs);

    // Bước 3: trả thưởng nếu thắng (nhận lại tiền cược + tiền lãi = gấp đôi)
    let balance = held.balance;
    if (won) {
      let paid = null;
      for (let attempt = 0; attempt < 3 && !paid; attempt++) {
        try {
          paid = await User.findOneAndUpdate(
            { userId: user.userId },
            { $inc: { balance: bet * 2, totalEarned: bet } },
            { new: true }
          );
        } catch (err) {
          console.error(`[/tx] Trả thưởng lỗi (lần ${attempt + 1}):`, err.message);
          await sleep(500);
        }
      }
      if (paid) balance = paid.balance;
      else console.error(`[/tx] KHÔNG trả được thưởng ${bet * 2} cho ${user.userId}`);
    }

    // Bước 4: thay tin nhắn "đang tung" bằng kết quả cuối cùng
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
        `## ${landed.emoji}  ${landed.label.toUpperCase()}  ${landed.emoji}\n` +
          (won
            ? `Bạn đoán đúng và nhận được ${formatCoin(bet * 2)} (lãi ${formatCoin(bet)})`
            : `Bạn đoán **${picked.label}** nên mất ${formatCoin(bet)}`)
      )
      .addFields(
        { name: 'Bạn chọn', value: `${picked.emoji} ${picked.label}`, inline: true },
        { name: 'Tiền cược', value: formatCoin(bet), inline: true },
        { name: 'Số dư hiện tại', value: formatCoin(balance) }
      )
      .setFooter({ text: 'Cooldown 5 giây mỗi lượt' });

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      // Nếu sửa tin nhắn thất bại thì gửi tin mới để người chơi vẫn thấy kết quả
      console.warn('[/tx] Không sửa được kết quả, gửi tin mới:', err.message);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});
    }
  },
};
