require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./commands');

/** Đăng ký slash command lên Discord. Nếu có GUILD_ID thì đăng ký riêng cho server đó (có hiệu lực ngay). */
async function registerCommands() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error('Thiếu DISCORD_TOKEN hoặc CLIENT_ID');
  }

  const body = [...loadCommands().values()].map((c) => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body });
  console.log(`[Lệnh] Đã đăng ký ${body.length} lệnh ${GUILD_ID ? '(server test)' : '(toàn cầu)'}`);
}

module.exports = { registerCommands };

// Chạy trực tiếp: npm run deploy
if (require.main === module) {
  registerCommands().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
