/**
 * config.js — Custom parser for the .env file
 * Supports standard POSIX keys (PGHOST, PGDATABASE, etc.) and legacy key formats.
 */
const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8');
  const config = {};
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    config[key] = value;
  });
  return config;
}

function parsePostgresSsl(value) {
  const mode = String(value || '').trim().toLowerCase();

  if (!mode || ['false', 'disable', 'disabled', '0', 'no'].includes(mode)) {
    return false;
  }

  if (['verify-ca', 'verify-full'].includes(mode)) {
    return { rejectUnauthorized: true };
  }

  return { rejectUnauthorized: false };
}

function parsePostgresUrl(value) {
  if (!value) return {};

  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return {};

    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? parseInt(parsed.port, 10) : undefined,
      user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      database: parsed.pathname
        ? decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
        : undefined,
      sslMode: parsed.searchParams.get('sslmode') || undefined,
    };
  } catch (_) {
    return {};
  }
}

const envPath = path.resolve(__dirname, '.env');
const env = parseEnv(envPath);
const databaseUrl = process.env.DATABASE_URL
  || process.env.AIVEN_DATABASE_URL
  || env.DATABASE_URL
  || env['Service URI'];
const urlDb = parsePostgresUrl(databaseUrl);

module.exports = {
  db: {
    host:     process.env.DB_HOST || process.env.PGHOST || urlDb.host || env.DB_HOST || env.PGHOST || env['Host'] || 'localhost',
    port:     parseInt(process.env.DB_PORT || process.env.PGPORT || urlDb.port || env.DB_PORT || env.PGPORT || env['Port'] || '5432', 10),
    user:     process.env.DB_USER || process.env.PGUSER || urlDb.user || env.DB_USER || env.PGUSER || env['User'] || 'postgres',
    password: process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : (process.env.PGPASSWORD !== undefined
        ? process.env.PGPASSWORD
        : (urlDb.password || env.DB_PASSWORD || env.PGPASSWORD || env['Password'] || '')),
    database: process.env.DB_NAME || process.env.PGDATABASE || urlDb.database || env.DB_NAME || env.PGDATABASE || env['Database'] || 'codevyuh_db',
    ssl:      parsePostgresSsl(
      process.env.DB_SSL !== undefined
        ? process.env.DB_SSL
        : (process.env.PGSSLMODE || urlDb.sslMode || env.DB_SSL || env.PGSSLMODE || env['SSL Mode'])
    ),
  },
  server: {
    port: parseInt(process.env.PORT || process.env.SERVER_PORT || env.PORT || env.SERVER_PORT || env['SERVER_PORT'] || '3001', 10),
  },
  auth: {
    mongoUri: process.env.MONGO_URI || env.MONGO_URI || '',
    sessionSecret: process.env.SESSION_SECRET || env.SESSION_SECRET || 'codevyuh-session-secret-2026',
    sessionName: process.env.SESSION_NAME || env.SESSION_NAME || 'codevyuh.sid',
    superAdmin: {
      username: process.env.SUPER_ADMIN_USERNAME || env.SUPER_ADMIN_USERNAME || 'admin',
      password: process.env.SUPER_ADMIN_PASSWORD || env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
      displayName: process.env.SUPER_ADMIN_NAME || env.SUPER_ADMIN_NAME || 'Platform Super Admin',
    },
  },
};
