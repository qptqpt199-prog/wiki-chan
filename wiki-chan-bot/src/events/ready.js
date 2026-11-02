const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[Bot] Đã đăng nhập: ${client.user.tag} • ${client.guilds.cache.size} server`);
    client.user.setPresence({
      activities: [{ name: '/daily • /top • /balance', type: ActivityType.Playing }],
      status: 'online',
    });
  },
};
