/**
 * db.js — PostgreSQL connection pool with connection health management
 */
const { Pool } = require('pg');
const { db: dbConfig } = require('./config');
const { ensurePostgres, requestAutoStart } = require('./db-supervisor');

// Configure connection pool with bounded resources and fast failure detection
const pool = new Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  ssl: dbConfig.ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

// Handle idle connection errors gracefully (e.g. backend socket drops)
pool.on('error', (err) => {
  console.warn('[DB-Pool] Idle connection dropped:', err.message);
});

/**
 * Execute a parameterized query against PostgreSQL.
 * Handles transient WAL recovery (57P03) with a single bounded retry,
 * and requests non-blocking supervisor startup if the database went offline.
 *
 * @param {string} text  SQL string
 * @param {Array}  params  Query parameters
 */
async function query(text, params = []) {
  let client;
  try {
    client = await pool.connect();
    return await client.query(text, params);
  } catch (err) {
    // If client had an error, destroy it to prevent stale sockets in pool
    if (client) {
      try { client.release(true); } catch (_) {}
      client = null;
    }

    const isStartingUp = err.code === '57P03' || (err.message && err.message.includes('starting up'));
    const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET';

    // Handle database in WAL recovery with a short pause and single retry
    if (isStartingUp) {
      console.warn('[DB-Pool] Database is initializing recovery. Pausing 1.5s before retry...');
      await new Promise(r => setTimeout(r, 1500));
      return await pool.query(text, params);
    }

    // If connection was refused/reset on a local instance, trigger supervisor in background
    if (isConnRefused && (dbConfig.host === '127.0.0.1' || dbConfig.host === 'localhost')) {
      console.warn(`[DB-Pool] Connection failed (${err.code}). Triggering background supervisor check...`);
      requestAutoStart(dbConfig.host, dbConfig.port, dbConfig.database);
    }

    throw err;
  } finally {
    if (client) {
      try { client.release(); } catch (_) {}
    }
  }
}

module.exports = { pool, query, ensurePostgres };
