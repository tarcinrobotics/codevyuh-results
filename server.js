/**
 * server.js — Main Express application
 * Serves the static frontend, mounts API routes, and enforces auth/RBAC.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const { server: serverConfig, auth: authConfig, db: dbConfig } = require('./config');
const { connectMongo, isMongoConnected, ensureSuperAdmin } = require('./auth/mongo');
const { getHomeForRole, getSessionUser } = require('./auth/access');
const { requireApiRoles, requireEventAccess, blockProtectedStaticFiles, serveProtectedPage } = require('./auth/middleware');
const { ensurePostgres, getDatabaseStatus, getLiveDatabaseStatus } = require('./db-supervisor');

async function bootstrap() {
  await ensurePostgres(dbConfig.host, dbConfig.port);
  await connectMongo();
  await ensureSuperAdmin();

  const { ensureTournamentScores } = require('./scripts/seed-tournament-scores');
  await ensureTournamentScores();

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const sessionStore = isMongoConnected() && authConfig.mongoUri
    ? MongoStore.create({
        mongoUrl: authConfig.mongoUri,
        collectionName: 'sessions',
      })
    : new session.MemoryStore();

  app.use(session({
    name: authConfig.sessionName,
    secret: authConfig.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  }));

  app.use((req, res, next) => {
    req.authUser = getSessionUser(req);
    next();
  });

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin-overview', requireApiRoles(['super_admin', 'event_admin', 'school_management']), require('./routes/admin-overview'));
  app.use('/api/event-insights', requireApiRoles(['super_admin', 'event_admin', 'school_management']), require('./routes/event-insights'));
  app.use('/api/zone-dashboard', requireApiRoles(['super_admin', 'event_admin', 'school_admin']), require('./routes/zone-dashboard'));
  app.use('/api/parent-view', requireApiRoles(['super_admin', 'event_admin', 'parent']), require('./routes/parent-view'));

  app.use(blockProtectedStaticFiles());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/', (req, res) => {
    return res.redirect('/login');
  });

  app.get('/login', (req, res) => {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });

  // Event-specific landing routes
  app.get('/kln/dashboard', requireEventAccess('0542016a-b443-421e-9ae0-a4787697b945'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-overview.html'));
  });

  app.get('/dolphin/dashboard', requireEventAccess('e4bd56c6-924d-49bb-9c3a-e2c74eab9f89'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-overview.html'));
  });

  // Preserved Dashboard Routes
  app.get('/admin-overview', ...serveProtectedPage('admin-overview.html', ['super_admin', 'event_admin', 'school_management']));
  app.get('/zone-dashboard', ...serveProtectedPage('zone-dashboard.html', ['super_admin', 'school_admin']));
  app.get('/parent-view', ...serveProtectedPage('parent-view.html', ['super_admin', 'parent']));
  app.get('/student-report', ...serveProtectedPage('student-report.html', ['super_admin', 'school_admin', 'parent']));
  app.get('/user-management', ...serveProtectedPage('user-management.html', ['super_admin']));

  app.all('/api/system/seed-tournament', async (req, res) => {
  const token = req.query.token || req.headers['x-seed-token'] || req.body?.token;
  const isSuperAdmin = req.authUser && req.authUser.role === 'super_admin';
  const expectedToken = process.env.SEED_TOKEN || 'codevyuh-seed-2026';

  if (!isSuperAdmin && token !== expectedToken) {
    return res.status(403).json({
      error: 'Unauthorized. Provide valid ?token= or login as super admin.',
    });
  }

  try {
    const { seedTournamentScores } = require('./scripts/seed-tournament-scores');
    await seedTournamentScores();
    return res.json({
      status: 'success',
      message: 'Tournament scores and submissions successfully seeded into PostgreSQL.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Seed Endpoint Error]', err);
    return res.status(500).json({
      error: 'Seeding failed',
      details: err.message,
    });
  }
});

  app.get('/api/health', async (req, res) => {
    const dbStatus = await getLiveDatabaseStatus();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mongo: isMongoConnected() ? 'connected' : 'in-memory-fallback',
      postgres: dbStatus,
    });
  });

  const PORT = serverConfig.port;
  const server = app.listen(PORT, () => {
    console.log(`\n✅  Codevyuh-dashboard running at http://localhost:${PORT}`);
    console.log(`   → Login          : http://localhost:${PORT}/login`);
    console.log(`   → KLN Landing    : http://localhost:${PORT}/kln/dashboard`);
    console.log(`   → Dolphin Landing: http://localhost:${PORT}/dolphin/dashboard`);
    console.log(`   → Admin Overview : http://localhost:${PORT}/admin-overview`);
    console.log(`   → School Dashboard: http://localhost:${PORT}/zone-dashboard`);
    console.log(`   → Parent View    : http://localhost:${PORT}/parent-view`);
    console.log(`   → User Access    : http://localhost:${PORT}/user-management\n`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        const { pool } = require('./db');
        await pool.end();
      } catch (_) {}
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('\n❌  Failed to start dashboard platform');
  console.error(`   ${err.message}\n`);
  process.exit(1);
});
