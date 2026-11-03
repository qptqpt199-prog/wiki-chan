const { randomInt } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const User = require('../models/User');
const { quaySo, colors } = require('../config');
const { getOrCreateUser } = require('../utils/users');
const { checkCooldown } = require('../utils/cooldown');
const { formatCoin } = require('../utils/format');

const TIERS = quaySo.tiers;
const PAYTABLE = TIERS.map((t) => `${t.emoji}${t.emoji}${t.emoji} x${t.multiplier}`).join('  •  ');

/** Quyết định kết quả: trả về tier trúng, hoặc null nếu thua */
function rollOutcome() {
  const roll = randomInt(100000) / 1000; // 0 -> 99.999
  let acc = 0;
  for (const tier of TIERS) {
    acc += tier.chance;
    if (roll < acc) return tier;
  }
  return null;
}

/** Tạo 3 ô kết quả. Thua thì chắc chắn không phải bộ 3 giống nhau */
function buildReels(tier) {
  if (tier) return [tier, tier, tier];
  let reels;
  do {
    reels = [0, 1, 2].map(() => TIERS[randomInt(TIERS.length)]);
  } while (reels[0] === reels[1] && reels[1] === reels[2]);
  return reels;
}

const randomTier = () => TIERS[randomInt(TIERS.length)];

/** Hiển thị 3 ô: ô đã chốt hiện đúng kết quả, ô chưa chốt hiện ngẫu nhiên */
function reelsLine(final, locked) {
  const cells = [0, 1, 2].map((i) => (i < locked ? final[i].emoji : randomTier().emoji));
  return `## ┃ ${cells.join(' ┃ ')} ┃`;
}

function spinningEmbed(user, frame, bet, final) {
  const locked = Math.min(2, Math.max(0, frame - 1)); // ô thứ 3 luôn để dành cho kết quả cuối
  const dots = '.'.repeat((frame % 3) + 1);

  return new EmbedBuilder()
    .setColor(colors.warning)
    .setAuthor({
      name: user.globalName || user.username,
      iconURL: user.displayAvatarURL({ size: 64 }),
    })
    .setTitle(`🎰 Đang quay số${dots}`)
    .setDescription(`${reelsLine(final, locked)}\n*Các ô đang quay...*`)
    .addFields({ name: 'Tiền cược', value: formatCoin(bet), inline: true })
    .setFooter({ text: PAYTABLE });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('qs')
    .setDescription('Quay số: ra đủ 3 màu giống nhau để nhận thưởng (xanh biển x1, xanh lá x2, đỏ x4)')
    .addIntegerOption((opt) =>
      opt
        .setName('so_tien')
        .setDescription(`Số Wiki Chan Coin muốn cược (Tối thiểu ${quaySo.minBet})`)
        .setRequired(true)
        .setMinValue(quaySo.minBet)
    ),

  async execute(interaction) {
    // Chống spam + không cho chồng 2 lượt quay cùng lúc
    const lockMs = Math.max(quaySo.cooldownMs, quaySo.animationFrames * quaySo.frameMs + 500);
    const wait = checkCooldown('qs', interaction.user.id, lockMs);
    if (wait > 0) {
      const embed = new EmbedBuilder()
        .setColor(colors.warning)
        .setDescription(`⏳ Từ từ thôi! Chờ **${Math.ceil(wait / 1000)} giây** nữa rồi quay tiếp nhé.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const bet = interaction.options.getInteger('so_tien');
    const user = await getOrCreateUser(interaction.user);

    if (user.balance < bet) {
      const embed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('💸 Không đủ tiền')
        .setDescription(
          `Bạn chỉ có ${formatCoin(user.balance)} mà muốn cược ${formatCoin(bet)}.\nDùng \`/daily\` để nhận thêm coin nhé!`
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Quyết định kết quả ngay (chỉ công bố sau hoạt ảnh)
    const tier = rollOutcome();
    const final = buildReels(tier);
    const payout = tier ? bet * tier.multiplier : 0;
    const net = payout - bet; // âm = mất, 0 = hòa vốn, dương = lãi

    // Trừ cược + trả thưởng trong MỘT thao tác duy nhất (có điều kiện đủ số dư).
    // Nhờ vậy dù bot khởi động lại giữa lúc quay, người chơi cũng không bị mất tiền oan.
    const settled = await User.findOneAndUpdate(
      { userId: user.userId, balance: { $gte: bet } },
      { $inc: { balance: net, totalEarned: Math.max(net, 0) } },
      { new: true }
    );

    if (!settled) {
      return interaction.reply({
        content: 'Số dư của bạn vừa thay đổi, hãy thử lại nhé!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Hoạt ảnh
    await interaction.reply({ embeds: [spinningEmbed(interaction.user, 0, bet, final)] });

    for (let frame = 1; frame < quaySo.animationFrames; frame++) {
      await sleep(quaySo.frameMs);
      try {
        await interaction.editReply({ embeds: [spinningEmbed(interaction.user, frame, bet, final)] });
      } catch (err) {
        console.warn('[/qs] Không sửa được khung hình:', err.message);
      }
    }
    await sleep(quaySo.frameMs);

    // Kết quả cuối
    let color, title, text;
    if (!tier) {
      color = colors.error;
      title = '😢 Trượt rồi...';
      text = `Không ra đủ 3 màu giống nhau nên bạn mất ${formatCoin(bet)}`;
    } else if (net === 0) {
      color = colors.warning;
      title = `${tier.emoji} Hòa vốn!`;
      text = `Ra 3 ${tier.name.toLowerCase()} nên bạn được hoàn lại ${formatCoin(bet)} (không lời, không lỗ)`;
    } else {
      color = colors.success;
      title = tier.multiplier >= 4 ? `🔥 JACKPOT ${tier.name.toUpperCase()} x${tier.multiplier}!` : `🎉 Trúng ${tier.name} x${tier.multiplier}!`;
      text = `Bạn nhận được ${formatCoin(payout)} (lãi ${formatCoin(net)})`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: interaction.user.globalName || interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ size: 64 }),
      })
      .setTitle(title)
      .setDescription(`${reelsLine(final, 3)}\n${text}`)
      .addFields(
        { name: 'Tiền cược', value: formatCoin(bet), inline: true },
        { name: 'Số dư hiện tại', value: formatCoin(settled.balance), inline: true }
      )
      .setFooter({ text: PAYTABLE });

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.warn('[/qs] Không sửa được kết quả, gửi tin mới:', err.message);
      await interaction.followUp({ embeds: [embed] }).catch(() => {});
    }
  },
};
