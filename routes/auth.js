const express = require('express');
const bcrypt = require('bcryptjs');
const UserAccount = require('../auth/models/UserAccount');
const { requireApiRoles } = require('../auth/middleware');
const { getHomeForRole, getSessionUser, EVENT_CONFIG } = require('../auth/access');
const { auth: authConfig } = require('../config');
const { query } = require('../db');

const router = express.Router();

// ── In-Memory Rate Limiting ────────────────────────────────────────────────
const loginAttempts = new Map(); // key -> [timestamps]
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_FAILED_ATTEMPTS = 5;

function isRateLimited(key) {
  const now = Date.now();
  const history = loginAttempts.get(key) || [];
  const recent = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  loginAttempts.set(key, recent);
  return recent.length >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const history = loginAttempts.get(key) || [];
  const recent = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(key, recent);
}

function clearRateLimit(key) {
  loginAttempts.delete(key);
}

function serializeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    eventId: user.eventId || null,
    eventName: user.eventName || (user.eventId && EVENT_CONFIG[user.eventId]?.name) || null,
    schoolName: user.schoolName || null,
    studentId: user.studentId || null,
    isActive: user.isActive,
    home: getHomeForRole(user.role, user),
  };
}

router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const targetEvent = String(req.body.targetEvent || '').trim();
    const returnTo = typeof req.body.returnTo === 'string' ? req.body.returnTo : '';

    const rateLimitKey = `${clientIp}:${username}`;
    if (isRateLimited(rateLimitKey)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please wait 1 minute before trying again.',
      });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const account = await UserAccount.findOne({ username });
    if (!account || !account.isActive) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If targetEvent was specified (e.g. from specific card), ensure account is authorized for that event
    if (targetEvent && account.role !== 'super_admin') {
      if (account.eventId !== targetEvent) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    clearRateLimit(rateLimitKey);

    const user = serializeUser(account);
    req.session.user = user;

    res.json({
      user,
      redirectTo: returnTo && returnTo.startsWith('/') ? returnTo : user.home,
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Unable to login right now' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(authConfig.sessionName);
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user });
});

router.get('/users', requireApiRoles(['super_admin', 'event_admin']), async (req, res) => {
  try {
    const authUser = req.authUser;
    let filter = {};

    if (authUser.role === 'event_admin') {
      // Event admin can only see accounts belonging to their own event or created by them
      filter = {
        $or: [
          { eventId: authUser.eventId },
          { createdBy: authUser.username },
          { username: authUser.username },
        ],
      };
    }

    const users = await UserAccount.find(filter)
      .sort({ createdAt: -1 })
      .select('-passwordHash')
      .lean();
    res.json(users);
  } catch (err) {
    console.error('[auth/users]', err.message);
    res.status(500).json({ error: 'Unable to load users' });
  }
});

router.get('/schools', requireApiRoles(['super_admin', 'event_admin']), async (req, res) => {
  try {
    const authUser = req.authUser;

    if (authUser.role === 'event_admin') {
      if (authUser.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
        const result = await query(
          `SELECT id, name FROM "School" WHERE name = 'KLN Vidyalaya CBSE Senior Secondary School' LIMIT 1`
        );
        return res.json(result.rows);
      }
      if (authUser.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
        return res.json([{ id: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89', name: 'Dolphin PRELIMS' }]);
      }
    }

    const result = await query(`
      SELECT id, name
      FROM "School"
      WHERE name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[auth/schools]', err.message);
    res.status(500).json({ error: 'Unable to load schools' });
  }
});

router.post('/users', requireApiRoles(['super_admin', 'event_admin']), async (req, res) => {
  try {
    const authUser = req.authUser;
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    const requestedRole = String(req.body.role || '').trim();
    const schoolName = String(req.body.schoolName || '').trim() || null;
    const studentId = String(req.body.studentId || '').trim() || null;

    if (!username || !password || !displayName || !requestedRole) {
      return res.status(400).json({ error: 'Username, password, display name, and role are required' });
    }

    // Role validation
    const allowedRoles = authUser.role === 'super_admin'
      ? ['super_admin', 'event_admin', 'school_admin', 'school_management', 'parent']
      : ['school_admin', 'school_management', 'parent'];

    if (!allowedRoles.includes(requestedRole)) {
      return res.status(400).json({ error: 'Role is not allowed' });
    }

    // Scope event and school if event_admin
    let scopedEventId = null;
    let scopedEventName = null;
    let scopedSchoolName = schoolName;

    if (authUser.role === 'event_admin') {
      scopedEventId = authUser.eventId;
      scopedEventName = authUser.eventName || (authUser.eventId && EVENT_CONFIG[authUser.eventId]?.name);
      if (authUser.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
        scopedSchoolName = 'KLN Vidyalaya CBSE Senior Secondary School';
      } else if (authUser.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
        scopedSchoolName = 'Dolphin PRELIMS';
      }
    } else if (schoolName) {
      const schoolCheck = await query(
        `SELECT id FROM "School" WHERE name = $1::text LIMIT 1`,
        [schoolName]
      );
      if (!schoolCheck.rows.length) {
        return res.status(400).json({ error: 'School name was not found in the platform database' });
      }
    }

    if (requestedRole === 'parent' && studentId && scopedSchoolName && scopedSchoolName !== 'Dolphin PRELIMS') {
      const studentCheck = await query(
        `SELECT u.id
         FROM "User" u
         JOIN "School" sc ON u."schoolId" = sc.id
         WHERE u.id = $1::text
           AND u.role = 'STUDENT'
           AND sc.name = $2::text
         LIMIT 1`,
        [studentId, scopedSchoolName]
      );
      if (!studentCheck.rows.length) {
        return res.status(400).json({ error: 'Student ID does not belong to the selected school' });
      }
    }

    const existing = await UserAccount.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const creator = getSessionUser(req);

    const user = await UserAccount.create({
      username,
      passwordHash,
      displayName,
      role: requestedRole,
      eventId: scopedEventId,
      eventName: scopedEventName,
      schoolName: (requestedRole === 'school_management' || requestedRole === 'school_admin' || requestedRole === 'parent') && !scopedEventId ? null : scopedSchoolName,
      studentId: requestedRole === 'parent' ? studentId : null,
      isActive: true,
      createdBy: creator?.username || 'system',
    });

    res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    console.error('[auth/create-user]', err.message);
    res.status(500).json({ error: 'Unable to create user' });
  }
});

module.exports = router;
