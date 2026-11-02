const { Events } = require('discord.js');
const { updatePresence } = require('../utils/presence');

// Bot được mời vào server mới -> cập nhật số liệu ngay
module.exports = {
  name: Events.GuildCreate,
  execute(guild) {
    console.log(`[Bot] Vào server mới: ${guild.name} (${guild.memberCount} thành viên)`);
    updatePresence(guild.client);
  },
};
