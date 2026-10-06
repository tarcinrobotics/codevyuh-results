const express = require('express');
const bcrypt = require('bcryptjs');
const UserAccount = require('../auth/models/UserAccount');
const { requireApiRoles } = require('../auth/middleware');
const { getHomeForRole, getSessionUser } = require('../auth/access');
const { auth: authConfig } = require('../config');
const { query } = require('../db');

const router = express.Router();

function serializeUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    schoolName: user.schoolName || null,
    studentId: user.studentId || null,
    isActive: user.isActive,
    home: getHomeForRole(user.role),
  };
}

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const returnTo = typeof req.body.returnTo === 'string' ? req.body.returnTo : '';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const account = await UserAccount.findOne({ username });
    if (!account || !account.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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

router.get('/users', requireApiRoles(['super_admin']), async (req, res) => {
  try {
    const users = await UserAccount.find({})
      .sort({ createdAt: -1 })
      .select('-passwordHash')
      .lean();
    res.json(users);
  } catch (err) {
    console.error('[auth/users]', err.message);
    res.status(500).json({ error: 'Unable to load users' });
  }
});

router.get('/schools', requireApiRoles(['super_admin']), async (req, res) => {
  try {
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

router.post('/users', requireApiRoles(['super_admin']), async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    const role = String(req.body.role || '').trim();
    const schoolName = String(req.body.schoolName || '').trim() || null;
    const studentId = String(req.body.studentId || '').trim() || null;

    if (!username || !password || !displayName || !role) {
      return res.status(400).json({ error: 'Username, password, display name, and role are required' });
    }

    if (!['school_admin', 'school_management', 'parent'].includes(role)) {
      return res.status(400).json({ error: 'Role is not allowed' });
    }

    if (schoolName) {
      const schoolCheck = await query(
        `SELECT id FROM "School" WHERE name = $1::text LIMIT 1`,
        [schoolName]
      );
      if (!schoolCheck.rows.length) {
        return res.status(400).json({ error: 'School name was not found in the platform database' });
      }
    }

    if (role === 'parent' && studentId && schoolName) {
      const studentCheck = await query(
        `SELECT u.id
         FROM "User" u
         JOIN "School" sc ON u."schoolId" = sc.id
         WHERE u.id = $1::text
           AND u.role = 'STUDENT'
           AND sc.name = $2::text
         LIMIT 1`,
        [studentId, schoolName]
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
    const scopedSchoolName = (role === 'school_management' || role === 'school_admin' || role === 'parent') ? null : schoolName;
    const scopedStudentId = role === 'parent' ? null : studentId;

    const user = await UserAccount.create({
      username,
      passwordHash,
      displayName,
      role,
      schoolName: scopedSchoolName,
      studentId: scopedStudentId,
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
