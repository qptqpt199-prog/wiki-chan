require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { connectDatabase } = require('./database');
const { loadCommands } = require('./commands');
const { registerCommands } = require('./deploy-commands');
const { startServer } = require('./server');

// Không để lỗi vặt làm sập bot
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Thiếu biến môi trường DISCORD_TOKEN');
  }

  // Mở web trước để Render nhận được cổng ngay
  startServer();

  await connectDatabase();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.commands = new Collection(loadCommands());

  // Nạp events
  const eventsDir = path.join(__dirname, 'events');
  for (const file of fs.readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
    const event = require(path.join(eventsDir, file));
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
  }

  // Tự đăng ký slash command mỗi lần khởi động (Render free không có shell)
  try {
    await registerCommands();
  } catch (err) {
    console.error('[Lệnh] Đăng ký thất bại:', err.message);
  }

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error('[Khởi động thất bại]', err);
  process.exit(1);
});
