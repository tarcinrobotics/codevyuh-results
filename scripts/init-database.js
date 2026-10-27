const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { db: dbConfig } = require('../config');

const dumpPath = path.join(__dirname, '..', 'backup_codevyuh_db_20261021_193140.dump');

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function runPgRestore(database) {
  const sslMode = dbConfig.ssl === false
    ? 'disable'
    : (dbConfig.ssl.rejectUnauthorized ? 'verify-full' : 'require');
  const env = {
    ...process.env,
    PGPASSWORD: dbConfig.password,
    PGSSLMODE: process.env.PGSSLMODE || sslMode,
  };
  const args = [
    '--exit-on-error',
    '--no-owner',
    '--no-acl',
    '--host', dbConfig.host,
    '--port', String(dbConfig.port),
    '--username', dbConfig.user,
    '--dbname', database,
    dumpPath,
  ];

  return new Promise((resolve, reject) => {
    const restore = spawn('pg_restore', args, { env, windowsHide: true });
    let stderr = '';

    restore.stderr.setEncoding('utf8');
    restore.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    restore.once('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(new Error('pg_restore was not found. Install PostgreSQL command-line tools and add its bin folder to PATH.'));
        return;
      }
      reject(error);
    });
    restore.once('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pg_restore exited with code ${code}.${stderr ? `\n${stderr.trim()}` : ''}`));
    });
  });
}

async function initializeDatabase() {
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Database backup was not found: ${dumpPath}`);
  }

  const admin = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres',
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: 5000,
  });

  await admin.connect();
  try {
    const existing = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbConfig.database]
    );

    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(dbConfig.database)}`);
      console.log(`Created database "${dbConfig.database}".`);
    } else {
      const target = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        ssl: dbConfig.ssl,
        connectionTimeoutMillis: 5000,
      });

      await target.connect();
      try {
        const objects = await target.query(`
          SELECT EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND n.nspname NOT LIKE 'pg_toast%'
          ) AS has_relations
        `);

        if (objects.rows[0].has_relations) {
          throw new Error(
            `Database "${dbConfig.database}" already contains user data. ` +
            'db:init only restores into a new or empty database; choose an empty database in .env.'
          );
        }
      } finally {
        await target.end();
      }
      console.log(`Using existing empty database "${dbConfig.database}".`);
    }
  } finally {
    await admin.end();
  }

  console.log(`Restoring ${path.basename(dumpPath)}...`);
  await runPgRestore(dbConfig.database);
  console.log(`Database "${dbConfig.database}" initialized successfully.`);
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
