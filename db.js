const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  let uri = process.env.MONGODB_URI || '';

  // Disable command buffering so queries return immediately to fallback when offline
  mongoose.set('bufferCommands', false);

  // Clean angle brackets if the user left them around their password
  uri = uri.replace(/:(<)([^<>@]+)(>)@/, ':$2@');

  if (!uri || uri.includes('<db_password>')) {
    console.log('\n============================================================');
    console.log('⚠️  [MongoDB] Notice: MONGODB_URI in .env contains "<db_password>".');
    console.log('👉 Please replace "<db_password>" in your .env file with your');
    console.log('   actual MongoDB Atlas user password for user "aman22".');
    console.log('============================================================\n');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000
    });
    isConnected = true;
    console.log('✅ [MongoDB] Successfully connected to MongoDB Atlas Cluster!');
    return true;
  } catch (err) {
    console.error('❌ [MongoDB] Connection error:', err.message);
    isConnected = false;
    return false;
  }
}

module.exports = { connectDB, getIsConnected: () => isConnected };
