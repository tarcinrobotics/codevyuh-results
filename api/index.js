/**
 * api/index.js — Serverless handler for Vercel deployment
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const { auth: authConfig, db: dbConfig } = require('../config');
const { connectMongo, ensureSuperAdmin } = require('../auth/mongo');
const { getHomeForRole, getSessionUser } = require('../auth/access');
const { requireApiRoles, blockProtectedStaticFiles, serveProtectedPage, requireEventAccess } = require('../auth/middleware');

const app = express();
let isInitialized = false;

async function initApp() {
  if (isInitialized) return;
  try {
    await connectMongo();
    await ensureSuperAdmin().catch((err) => {
      console.warn('[Vercel] Super admin seed warning:', err.message);
    });
  } catch (err) {
    console.error('[Vercel] DB init error:', err.message);
  }
  isInitialized = true;
}

app.use(async (req, res, next) => {
  await initApp();
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: authConfig.sessionName,
  secret: authConfig.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: authConfig.mongoUri,
    collectionName: 'sessions',
  }),
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

app.use('/api/auth', require('../routes/auth'));
app.use('/api/admin-overview', requireApiRoles(['super_admin', 'event_admin', 'school_management']), require('../routes/admin-overview'));
app.use('/api/event-insights', requireApiRoles(['super_admin', 'event_admin', 'school_management']), require('../routes/event-insights'));
app.use('/api/zone-dashboard', requireApiRoles(['super_admin', 'event_admin', 'school_admin']), require('../routes/zone-dashboard'));
app.use('/api/parent-view', requireApiRoles(['super_admin', 'event_admin', 'parent']), require('../routes/parent-view'));

app.use(blockProtectedStaticFiles());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  return res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

// Event-specific landing routes
app.get('/kln/dashboard', requireEventAccess('0542016a-b443-421e-9ae0-a4787697b945'), (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin-overview.html'));
});

app.get('/dolphin/dashboard', requireEventAccess('e4bd56c6-924d-49bb-9c3a-e2c74eab9f89'), (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'admin-overview.html'));
});

app.get('/admin-overview', ...serveProtectedPage('admin-overview.html', ['super_admin', 'event_admin', 'school_management']));
app.get('/zone-dashboard', ...serveProtectedPage('zone-dashboard.html', ['super_admin', 'event_admin', 'school_admin']));
app.get('/parent-view', ...serveProtectedPage('parent-view.html', ['super_admin', 'event_admin', 'parent']));
app.get('/student-report', ...serveProtectedPage('student-report.html', ['super_admin', 'event_admin', 'parent']));
app.get('/user-management', ...serveProtectedPage('user-management.html', ['super_admin', 'event_admin']));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongo: 'connected',
    environment: 'vercel-serverless',
  });
});

module.exports = app;
