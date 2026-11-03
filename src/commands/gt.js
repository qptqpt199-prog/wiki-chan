const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags,
} = require('discord.js');
const Company = require('../models/Company');
const { colors } = require('../config');
const { formatCoin } = require('../utils/format');
const { settleCompany, dissolveCompany, calcStats } = require('../utils/company');

module.exports = {
  data: new SlashCommandBuilder().setName('gt').setDescription('Giải thể công ty của bạn'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const userId = interaction.user.id;

    await settleCompany(interaction.client, userId);
    const c = await Company.findOne({ userId, status: 'active' });
    if (!c) return interaction.editReply('Bạn không có công ty nào để giải thể.');

    const bill = Math.round(calcStats(c).dailyBill);
    const confirmId = `gt_ok_${interaction.id}`;
    const cancelId = `gt_no_${interaction.id}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Giải thể').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Hủy').setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(colors.warning)
          .setTitle('Bạn chắc chắn muốn giải thể? ⚠️')
          .setDescription(
            `Công ty sẽ đóng cửa ngay và **không hoàn lại vốn**. Bill hôm nay vẫn tính đủ cả ngày, khoảng ${formatCoin(bill)}, trừ vào ví của bạn.`
          ),
      ],
      components: [row],
    });

    const btn = await msg
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === userId && [confirmId, cancelId].includes(i.customId),
        time: 30_000,
      })
      .catch(() => null);

    if (!btn) return interaction.editReply({ content: 'Hết thời gian, công ty vẫn được giữ nguyên.', embeds: [], components: [] });
    if (btn.customId === cancelId) return btn.update({ content: 'Đã hủy, công ty vẫn hoạt động 👍', embeds: [], components: [] });

    await btn.deferUpdate();
    const result = await dissolveCompany(interaction.client, userId);
    if (!result) {
      return interaction.editReply({ content: 'Công ty không còn hoạt động, không thể giải thể.', embeds: [], components: [] });
    }

    const embed = new EmbedBuilder()
      .setColor(colors.success)
      .setTitle('Đã giải thể công ty 🏁')
      .setDescription(`Bill hôm nay ${formatCoin(result.bill)} đã được trừ. Ví hiện tại: ${formatCoin(result.balance)}.\nBạn có thể khởi nghiệp lại bất cứ lúc nào bằng \`/kn\`.`);
    return interaction.editReply({ embeds: [embed], components: [] });
  },
};
