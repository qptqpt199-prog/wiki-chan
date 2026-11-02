const User = require('../models/User');

/**
 * Lấy người dùng trong DB, tạo mới nếu chưa có.
 * Mỗi lần gọi sẽ cập nhật tên và avatar để web hiển thị đúng.
 */
async function getOrCreateUser(discordUser) {
  const avatar = discordUser.displayAvatarURL({ extension: 'png', size: 128 });
  const username = discordUser.globalName || discordUser.username;

  return User.findOneAndUpdate(
    { userId: discordUser.id },
    { $set: { username, avatar } },
    { upsert: true, new: true }
  );
}

module.exports = { getOrCreateUser };
