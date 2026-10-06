const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { auth: authConfig } = require('../config');
const UserAccount = require('./models/UserAccount');

async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  try {
    await mongoose.connect(authConfig.mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
  } catch (err) {
    console.warn('[Mongo] Initial connection attempt failed, retrying in 2s...', err.message);
    await new Promise(r => setTimeout(r, 2000));
    await mongoose.connect(authConfig.mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
  }

  return mongoose.connection;
}

async function ensureSuperAdmin() {
  const username = authConfig.superAdmin.username.trim().toLowerCase();
  const existing = await UserAccount.findOne({ username });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(authConfig.superAdmin.password, 10);
  const user = await UserAccount.create({
    username,
    displayName: authConfig.superAdmin.displayName,
    role: 'super_admin',
    passwordHash,
    isActive: true,
  });

  console.log(`\n🔐  Seeded default super admin: ${username}`);
  console.log('    Update SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD in .env for production use.\n');
  return user;
}

module.exports = {
  connectMongo,
  ensureSuperAdmin,
};
