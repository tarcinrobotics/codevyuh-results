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
  },
  {
    username: 'velammaladmin',
    password: 'Velammal@2026',
    displayName: 'School Admin - Back Office',
    role: 'school_management',
  },
  {
    username: 'velammalschool',
    password: 'Velammal@codevyuh',
    displayName: 'School - Individual School',
    role: 'school_admin',
  },
  {
    username: 'parent',
    password: 'parent',
    displayName: 'Parent - Shared Credential',
    role: 'parent',
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
        schoolName: null,
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
