const { currency } = require('../config');

/** 1234567 -> "1.234.567" */
function formatNumber(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.floor(n || 0));
}

/** 1234 -> "🪙 1.234 WCC" */
function formatCoin(n) {
  return `${currency.emoji} **${formatNumber(n)}** ${currency.short}`;
}

/** Số mili giây -> "5 giờ 20 phút" */
function formatDuration(ms) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts = [];
  if (h) parts.push(`${h} giờ`);
  if (m) parts.push(`${m} phút`);
  if (!h && !m) parts.push(`${s} giây`);
  return parts.join(' ');
}

module.exports = { formatNumber, formatCoin, formatDuration };
