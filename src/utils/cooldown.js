// Cooldown lưu trong bộ nhớ, dùng chung cho mọi lệnh game.
const store = new Map();

/**
 * Kiểm tra và đặt cooldown.
 * @returns {number} số ms còn phải chờ (0 nghĩa là được phép dùng, và cooldown mới đã được bắt đầu)
 */
function checkCooldown(key, userId, durationMs) {
  const id = `${key}:${userId}`;
  const now = Date.now();
  const expires = store.get(id) || 0;

  if (expires > now) return expires - now;

  store.set(id, now + durationMs);
  // Dọn bộ nhớ sau khi hết hạn
  setTimeout(() => {
    if ((store.get(id) || 0) <= Date.now()) store.delete(id);
  }, durationMs + 1000).unref();

  return 0;
}

module.exports = { checkCooldown };
