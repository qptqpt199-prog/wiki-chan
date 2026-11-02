const fs = require('node:fs');
const path = require('node:path');

/** Tự động nạp mọi file lệnh trong thư mục này. Thêm game mới chỉ cần thả file vào đây. */
function loadCommands() {
  const commands = new Map();

  for (const file of fs.readdirSync(__dirname)) {
    if (!file.endsWith('.js') || file === 'index.js') continue;
    const command = require(path.join(__dirname, file));
    if (!command.data || !command.execute) {
      console.warn(`[Lệnh] Bỏ qua ${file}: thiếu "data" hoặc "execute"`);
      continue;
    }
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands };
