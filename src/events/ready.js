const { Events } = require('discord.js');
const { updatePresence } = require('../utils/presence');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[Bot] Đã đăng nhập: ${client.user.tag} • ${client.guilds.cache.size} server`);

    updatePresence(client);

    // Làm mới định kỳ (số thành viên thay đổi liên tục) và giữ trạng thái luôn online
    setInterval(() => updatePresence(client), 5 * 60 * 1000);
  },
};
