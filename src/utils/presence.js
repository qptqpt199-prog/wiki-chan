const { ActivityType } = require('discord.js');

/** 28584 -> "28.584" */
const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);

/**
 * Đặt trạng thái: chấm xanh "Trực tuyến" + dòng trạng thái tùy chỉnh
 * Ví dụ: 🌐 238 Server 👥 28.584 Members
 */
function updatePresence(client) {
  const guilds = client.guilds.cache;
  const serverCount = guilds.size;

  // memberCount đã gồm chính bot này nên trừ đi 1 cho mỗi server
  const memberCount = guilds.reduce((sum, g) => sum + Math.max(0, (g.memberCount || 0) - 1), 0);

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Custom Status', // bắt buộc phải có, Discord sẽ hiển thị phần "state"
        type: ActivityType.Custom,
        state: `🌐 ${fmt(serverCount)} Server  👥 ${fmt(memberCount)} Members`,
      },
    ],
  });
}

module.exports = { updatePresence };
