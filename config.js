/**
 * config.js — Custom parser for the .env file
 * The .env uses a non-standard format (e.g. "SSL Mode=require")
 * so we parse it manually instead of using dotenv.
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
    const value = trimmed.slice(idx + 1).trim();
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

  // Aiven's default `sslmode=require` encrypts traffic without requiring
  // the project CA certificate to be bundled with the application.
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
    host:     process.env.DB_HOST || process.env.PGHOST || urlDb.host || env['Host'] || 'localhost',
    port:     parseInt(process.env.DB_PORT || process.env.PGPORT || urlDb.port || env['Port'] || '5432', 10),
    user:     process.env.DB_USER || process.env.PGUSER || urlDb.user || env['User'] || 'postgres',
    password: process.env.DB_PASSWORD !== undefined
      ? process.env.DB_PASSWORD
      : (process.env.PGPASSWORD !== undefined ? process.env.PGPASSWORD : (urlDb.password || env['Password'] || '')),
    database: process.env.DB_NAME || process.env.PGDATABASE || urlDb.database || env['Database'] || 'postgres',
    ssl:      parsePostgresSsl(
      process.env.DB_SSL !== undefined
        ? process.env.DB_SSL
        : (process.env.PGSSLMODE || urlDb.sslMode || env['SSL Mode'])
    ),
  },
  server: {
    port: parseInt(process.env.PORT || process.env.SERVER_PORT || env['SERVER_PORT'] || '3000', 10),
  },
  auth: {
    mongoUri: process.env.MONGO_URI || env.MONGO_URI || 'mongodb://127.0.0.1:27017/velammal_dashboard_auth',
    sessionSecret: process.env.SESSION_SECRET || env.SESSION_SECRET || 'velammal-dashboard-local-secret',
    sessionName: process.env.SESSION_NAME || env.SESSION_NAME || 'velammal.sid',
    superAdmin: {
      username: process.env.SUPER_ADMIN_USERNAME || env.SUPER_ADMIN_USERNAME || 'superadmin',
      password: process.env.SUPER_ADMIN_PASSWORD || env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
      displayName: process.env.SUPER_ADMIN_NAME || env.SUPER_ADMIN_NAME || 'Platform Super Admin',
    },
  },
};
