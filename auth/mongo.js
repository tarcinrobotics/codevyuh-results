const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { auth: authConfig } = require('../config');
const UserAccount = require('./models/UserAccount');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

let mongoConnected = false;

function isMongoConnected() {
  return mongoConnected && mongoose.connection.readyState === 1;
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    mongoConnected = true;
    return mongoose.connection;
  }

  // If no mongoUri or default local without running daemon, test quickly
  if (!authConfig.mongoUri) {
    console.log('[Auth] No MONGO_URI specified; using resilient in-memory auth store.');
    return null;
  }

  try {
    await mongoose.connect(authConfig.mongoUri, {
      serverSelectionTimeoutMS: 2000,
    });
    mongoConnected = true;
    console.log('✅  [Auth] Connected to MongoDB.');
    return mongoose.connection;
  } catch (err) {
    mongoConnected = false;
    console.log(`ℹ️   [Auth] MongoDB not available (${err.message}). Using resilient in-memory auth store.`);
    return null;
  }
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
    console.log(`🔐  Seeded default super admin: ${username}`);
  }

  await ensureEventAdmins();
}

module.exports = {
  connectMongo,
  isMongoConnected,
  ensureSuperAdmin,
  ensureEventAdmins,
  EVENT_ADMIN_DEFINITIONS,
};
