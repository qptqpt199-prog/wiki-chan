const { Events } = require('discord.js');
const { updatePresence } = require('../utils/presence');

// Bot bị đuổi hoặc rời server -> cập nhật số liệu ngay
module.exports = {
  name: Events.GuildDelete,
  execute(guild) {
    console.log(`[Bot] Rời server: ${guild.name || guild.id}`);
    updatePresence(guild.client);
  },
};
