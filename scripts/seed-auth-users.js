const bcrypt = require('bcryptjs');
const { connectMongo, ensureSuperAdmin } = require('../auth/mongo');
const UserAccount = require('../auth/models/UserAccount');
const { auth: authConfig } = require('../config');

const SHARED_USERS = [
  {
    username: authConfig.superAdmin.username,
    password: authConfig.superAdmin.password,
    displayName: authConfig.superAdmin.displayName,
    role: 'super_admin',
    eventId: null,
    eventName: null,
    schoolName: null,
  },
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
  {
    username: 'velammaladmin',
    password: 'Velammal@2026',
    displayName: 'School Admin - Back Office',
    role: 'school_management',
    eventId: null,
    eventName: null,
    schoolName: null,
  },
  {
    username: 'velammalschool',
    password: 'Velammal@codevyuh',
    displayName: 'School - Individual School',
    role: 'school_admin',
    eventId: null,
    eventName: null,
    schoolName: null,
  },
  {
    username: 'parent',
    password: 'parent',
    displayName: 'Parent - Shared Credential',
    role: 'parent',
    eventId: null,
    eventName: null,
    schoolName: null,
  },
];

async function upsertSharedUser(definition) {
  const passwordHash = await bcrypt.hash(definition.password, 10);

  const user = await UserAccount.findOneAndUpdate(
    { username: definition.username.toLowerCase() },
    {
      $set: {
        username: definition.username.toLowerCase(),
        displayName: definition.displayName,
        role: definition.role,
        passwordHash,
        eventId: definition.eventId || null,
        eventName: definition.eventName || null,
        schoolName: definition.schoolName || null,
        studentId: null,
        isActive: true,
        createdBy: 'seed-auth-users-script',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return user;
}

async function main() {
  await connectMongo();
  await ensureSuperAdmin();

  console.log('\nSeeding shared auth users...\n');

  for (const definition of SHARED_USERS) {
    const user = await upsertSharedUser(definition);
    console.log(`- ${user.username} -> ${user.role} (${user.displayName})`);
  }

  console.log('\nSeed complete.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFailed to seed shared auth users');
  console.error(err);
  process.exit(1);
});
