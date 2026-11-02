const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Thiếu biến môi trường MONGODB_URI');
  }

  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Mất kết nối, đang thử lại...'));
  mongoose.connection.on('reconnected', () => console.log('[MongoDB] Đã kết nối lại'));
  mongoose.connection.on('error', (err) => console.error('[MongoDB] Lỗi:', err.message));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('[MongoDB] Đã kết nối thành công');
}

module.exports = { connectDatabase };
