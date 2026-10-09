const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { auth: authConfig } = require('../config');
const UserAccount = require('./models/UserAccount');

// On Windows / home ISPs, Node.js SRV resolution for mongodb+srv can fail with ECONNREFUSED.
// Configuring public DNS resolvers ensures Atlas SRV connection succeeds reliably.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

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

const EVENT_ADMIN_DEFINITIONS = [
  {
    username: 'admin@kln',
    password: process.env.KLN_ADMIN_PASSWORD || 'klnprelims@2026',
    displayName: 'KLN PRELIMS Administrator',
    role: 'event_admin',
    eventId: '0542016a-b443-421e-9ae0-a4787697b945',
    eventName: 'KLN PRELIMS',
    schoolName: 'KLN Vidyalaya CBSE Senior Secondary School',
  },
  {
    username: 'admin@dolphin',
    password: process.env.DOLPHIN_ADMIN_PASSWORD || 'dolphinprelims@2026',
    displayName: 'Dolphin PRELIMS Administrator',
    role: 'event_admin',
    eventId: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89',
    eventName: 'Dolphin PRELIMS',
    schoolName: null,
  },
];

async function ensureEventAdmins() {
  for (const def of EVENT_ADMIN_DEFINITIONS) {
    const username = def.username.trim().toLowerCase();
    const existing = await UserAccount.findOne({ username });
    if (!existing) {
      const passwordHash = await bcrypt.hash(def.password, 10);
      await UserAccount.create({
        username,
        displayName: def.displayName,
        role: def.role,
        passwordHash,
        eventId: def.eventId,
        eventName: def.eventName,
        schoolName: def.schoolName,
        isActive: true,
        createdBy: 'system_bootstrap',
      });
      console.log(`🔐  Seeded event admin: ${username} (${def.eventName})`);
    } else {
      const passwordHash = await bcrypt.hash(def.password, 10);
      existing.role = def.role;
      existing.eventId = def.eventId;
      existing.eventName = def.eventName;
      existing.schoolName = def.schoolName;
      existing.displayName = def.displayName;
      existing.passwordHash = passwordHash;
      existing.isActive = true;
      await existing.save();
    }
  }
}

async function ensureSuperAdmin() {
  const username = authConfig.superAdmin.username.trim().toLowerCase();
  const existing = await UserAccount.findOne({ username });
  if (!existing) {
    const passwordHash = await bcrypt.hash(authConfig.superAdmin.password, 10);
    await UserAccount.create({
      username,
      displayName: authConfig.superAdmin.displayName,
      role: 'super_admin',
      passwordHash,
      isActive: true,
    });
    console.log(`\n🔐  Seeded default super admin: ${username}`);
    console.log('    Update SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD in .env for production use.\n');
  }

  await ensureEventAdmins();
  return existing;
}

module.exports = {
  connectMongo,
  ensureSuperAdmin,
  ensureEventAdmins,
};
