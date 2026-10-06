/**
 * db-supervisor.js — Production-grade PostgreSQL process supervisor & connection monitor
 *
 * Guarantees:
 * 1. Exactly ONE startup operation at a time (singleton mutex).
 * 2. Bounded retries with exponential backoff and failure cooldown.
 * 3. Pure in-process TCP/query checks — ZERO cmd.exe calls, ZERO terminal windows.
 * 4. Safe spawn with shell: false and windowsHide: true (never creates a console window).
 * 5. Idempotent: returns instantly if database is already accepting queries.
 */

const net = require('net');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ── State & Configuration ──────────────────────────────────────────────────
const PG_PORT = 54333;
const PG_HOST = '127.0.0.1';
const PG_DATA_DIR = 'D:\\temp_pgsql\\data';
const PG_BIN_CANDIDATES = [
  'D:\\temp_pgsql\\pgsql\\bin\\postgres.exe',
  'C:\\Program Files\\PostgreSQL\\17\\bin\\postgres.exe',
  'C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe',
];

const MAX_STARTUP_ATTEMPTS = 3;
const COOLDOWN_DURATION_MS = 15000; // 15s cooldown after max failures

let activeStartupPromise = null;
let consecutiveFailures = 0;
let lastFailureTimestamp = 0;
let lastKnownStatus = {
  isReady: false,
  checkedAt: 0,
  message: 'Initializing supervisor',
};

/**
 * Checks if a TCP port is open and accepting socket connections.
 * Pure Node.js in-process TCP socket — creates zero external processes.
 */
function checkTcpPort(host = PG_HOST, port = PG_PORT, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      settled = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

/**
 * Checks if PostgreSQL is fully ready to execute SQL queries.
 * Connects directly using a standalone pg.Client (bypassing the pool) and runs SELECT 1.
 */
async function checkPostgresReadiness(host = PG_HOST, port = PG_PORT, dbName = 'postgres') {
  const portOpen = await checkTcpPort(host, port);
  if (!portOpen) return false;

  const client = new Client({
    host,
    port,
    user: 'postgres',
    database: dbName,
    connectionTimeoutMillis: 1500,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT 1 AS ready;');
    await client.end();
    return res.rows && res.rows[0]?.ready === 1;
  } catch (err) {
    try { await client.end(); } catch (_) {}
    return false;
  }
}

/**
 * Inspects D:\temp_pgsql\data\postmaster.pid to see if an instance is already running.
 */
function getPostmasterPid() {
  const pidFile = path.join(PG_DATA_DIR, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return null;

  try {
    const content = fs.readFileSync(pidFile, 'utf8');
    const firstLine = content.split('\n')[0].trim();
    const pid = parseInt(firstLine, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Verifies if a given Windows process ID is actively alive.
 */
function isPidAlive(pid) {
  if (!pid) return false;
  try {
    // Calling process.kill(pid, 0) tests existence without sending a signal
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM'; // Process exists but lack permission
  }
}

/**
 * Ensures PostgreSQL is running.
 * Thread-safe / Promise-safe singleton: multiple concurrent calls await the exact same operation.
 */
async function ensurePostgres(host = PG_HOST, port = PG_PORT, dbName = 'codevyuh_db') {
  // Only manage local PostgreSQL instances
  if (host !== '127.0.0.1' && host !== 'localhost') {
    return true;
  }

  // 1. Check if already accepting queries (takes ~2ms)
  const isReady = await checkPostgresReadiness(host, port, dbName);
  if (isReady) {
    consecutiveFailures = 0;
    lastKnownStatus = { isReady: true, checkedAt: Date.now(), message: 'Database operational' };
    return true;
  }

  // 2. Check failure cooldown and exponential backoff to prevent thrashing
  const now = Date.now();
  if (consecutiveFailures >= MAX_STARTUP_ATTEMPTS) {
    const elapsed = now - lastFailureTimestamp;
    if (elapsed < COOLDOWN_DURATION_MS) {
      console.warn(`[DB-Supervisor] Startup in backoff cooldown (${Math.round((COOLDOWN_DURATION_MS - elapsed) / 1000)}s remaining). Suppressing spawn.`);
      return false;
    }
    // Cooldown expired, allow retry
    consecutiveFailures = 0;
  } else if (consecutiveFailures > 0) {
    const backoffMs = Math.min(1000 * Math.pow(2, consecutiveFailures - 1), 6000);
    const elapsed = now - lastFailureTimestamp;
    if (elapsed < backoffMs) {
      console.warn(`[DB-Supervisor] Exponential backoff active (${Math.round((backoffMs - elapsed) / 1000)}s remaining for attempt ${consecutiveFailures + 1}). Pausing...`);
      await new Promise(r => setTimeout(r, backoffMs - elapsed));
    }
  }

  // 3. Return active startup promise if an operation is already in progress
  if (activeStartupPromise) {
    return activeStartupPromise;
  }

  // 4. Begin single startup operation
  activeStartupPromise = (async () => {
    console.log(`[DB-Supervisor] PostgreSQL on ${host}:${port} is offline. Initiating single managed start...`);

    const pgBin = PG_BIN_CANDIDATES.find(p => fs.existsSync(p));
    if (!pgBin || !fs.existsSync(PG_DATA_DIR)) {
      console.error(`[DB-Supervisor] PostgreSQL binary or data directory missing. Aborting.`);
      lastKnownStatus = { isReady: false, checkedAt: Date.now(), message: 'PostgreSQL files not found' };
      consecutiveFailures++;
      lastFailureTimestamp = Date.now();
      return false;
    }

    // Check if postmaster.pid already has an active PID
    const existingPid = getPostmasterPid();
    if (existingPid && isPidAlive(existingPid)) {
      console.log(`[DB-Supervisor] Detected existing PostgreSQL process (PID: ${existingPid}). Waiting for readiness...`);
    } else {
      // Clean up stale lock file if the process died previously
      const pidFile = path.join(PG_DATA_DIR, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
          console.log(`[DB-Supervisor] Cleaned up stale lock file ${pidFile}`);
        } catch (_) {}
      }

      // Prefer pg_ctl.exe for detached daemon management on Windows
      const pgCtl = path.join(path.dirname(pgBin), 'pg_ctl.exe');
      const logFile = path.join(path.dirname(PG_DATA_DIR), 'logfile.log');

      if (fs.existsSync(pgCtl)) {
        console.log(`[DB-Supervisor] Starting detached PostgreSQL daemon via pg_ctl on port ${port}...`);
        const ctlChild = spawn(pgCtl, [
          'start',
          '-D', PG_DATA_DIR,
          '-l', logFile,
          '-o', `-p ${port}`,
          '-w',
        ], {
          windowsHide: true,
          shell: false,
          stdio: 'ignore',
        });

        await new Promise((resolve) => {
          ctlChild.once('exit', () => resolve());
          ctlChild.once('error', () => resolve());
          setTimeout(resolve, 8000);
        });
        console.log(`[DB-Supervisor] pg_ctl startup completed. Verifying SQL readiness...`);
      } else {
        console.log(`[DB-Supervisor] Spawning detached PostgreSQL daemon on port ${port}...`);
        const child = spawn(pgBin, ['-D', PG_DATA_DIR, '-p', String(port)], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
          shell: false,
        });
        child.unref();
        console.log(`[DB-Supervisor] Daemon process spawned (PID: ${child.pid}). Waiting for initialization...`);
      }
    }

    // 5. Poll for readiness with bounded timeout (12s)
    const startTime = Date.now();
    const timeoutMs = 12000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 500));
      const ready = await checkPostgresReadiness(host, port, dbName);
      if (ready) {
        const elapsed = Date.now() - startTime;
        console.log(`[DB-Supervisor] ✅ PostgreSQL is READY and accepting queries on port ${port} (took ${elapsed}ms).`);
        consecutiveFailures = 0;
        lastKnownStatus = { isReady: true, checkedAt: Date.now(), message: 'Database operational' };
        return true;
      }
    }

    console.error(`[DB-Supervisor] ❌ Timed out waiting for PostgreSQL readiness after ${timeoutMs}ms.`);
    consecutiveFailures++;
    lastFailureTimestamp = Date.now();
    lastKnownStatus = { isReady: false, checkedAt: Date.now(), message: 'Database startup timed out' };
    return false;
  })().finally(() => {
    activeStartupPromise = null;
  });

  return activeStartupPromise;
}

/**
 * Non-blocking auto-start request.
 * Can be called by routes when connection errors occur without blocking the request loop.
 */
function requestAutoStart(host = PG_HOST, port = PG_PORT, dbName = 'codevyuh_db') {
  if (!activeStartupPromise) {
    ensurePostgres(host, port, dbName).catch(err => {
      console.error('[DB-Supervisor] Background start error:', err.message);
    });
  }
}

function getDatabaseStatus() {
  return {
    ...lastKnownStatus,
    consecutiveFailures,
    isStartupInProgress: !!activeStartupPromise,
  };
}

async function getLiveDatabaseStatus(host = PG_HOST, port = PG_PORT, dbName = 'codevyuh_db') {
  if (Date.now() - lastKnownStatus.checkedAt < 3000) {
    return getDatabaseStatus();
  }

  const isReady = await checkPostgresReadiness(host, port, dbName);
  lastKnownStatus = {
    isReady,
    checkedAt: Date.now(),
    message: isReady ? 'Database operational' : 'Database offline or unresponsive',
  };
  return getDatabaseStatus();
}

module.exports = {
  checkTcpPort,
  checkPostgresReadiness,
  ensurePostgres,
  requestAutoStart,
  getDatabaseStatus,
  getLiveDatabaseStatus,
};
