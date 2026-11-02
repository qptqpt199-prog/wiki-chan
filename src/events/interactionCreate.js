const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[Lệnh /${interaction.commandName}] Lỗi:`, error);

      const message = { content: 'Ôi, Wiki Chan gặp lỗi rồi 😢 Bạn thử lại sau nhé!', ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(message);
        } else {
          await interaction.reply(message);
        }
      } catch (e) {
        console.error('[Lệnh] Không thể gửi thông báo lỗi:', e.message);
      }
    }
  },
};
