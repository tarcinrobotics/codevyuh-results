/**
 * routes/parent-view.js
 * All API endpoints for /parent-view (Parent-facing student analytics)
 * Enforces event-level access control for KLN PRELIMS and Dolphin PRELIMS.
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const { getScopedSchool, getScopedStudentId, filterSchoolsForUser } = require('../auth/access');

function nullify(v) {
  return (v === 'null' || v === '' || v === undefined || v === null) ? null : String(v);
}

async function verifyStudentBelongsToUser(req, studentId) {
  if (!studentId) return false;
  const user = req.authUser;
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  if (user.role === 'event_admin' && user.eventId) {
    const check = await query(
      `SELECT 1 FROM "UserEvent" WHERE "eventId" = $1::text AND "userId" = $2::text LIMIT 1`,
      [user.eventId, studentId]
    );
    return check.rows.length > 0;
  }

  if (user.role === 'parent') {
    if (user.studentId && user.studentId !== studentId) return false;
    return true;
  }

  return true;
}

// ── GET /api/parent-view/schools ──────────────────────────────────────────
router.get('/schools', async (req, res) => {
  try {
    const user = req.authUser;
    if (user && user.role === 'event_admin' && user.eventId) {
      if (user.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
        return res.json([
          { id: 'cc6e4029-ee59-4f58-8daf-e9233fb636a5', name: 'KLN Vidyalaya CBSE Senior Secondary School' }
        ]);
      }
      if (user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
        return res.json([
          { id: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89', name: 'Dolphin PRELIMS' }
        ]);
      }
    }

    const result = await query(`
      SELECT id, name
      FROM "School"
      WHERE name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
      ORDER BY name ASC
    `);

    const schools = filterSchoolsForUser(req, result.rows, 'name');
    if (!user || user.role === 'super_admin') {
      if (!schools.some(s => s.name === 'Dolphin PRELIMS')) {
        schools.unshift({ id: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89', name: 'Dolphin PRELIMS' });
      }
    }

    res.json(schools);
  } catch (err) {
    console.error('[pv/schools]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/students-by-school?school=<name> ─────────────────
router.get('/students-by-school', async (req, res) => {
  const user = req.authUser;
  let school = getScopedSchool(req, nullify(req.query.school));

  if (user && user.role === 'event_admin' && user.eventId) {
    if (user.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
      school = 'KLN Vidyalaya CBSE Senior Secondary School';
    } else if (user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
      school = 'Dolphin PRELIMS';
    }
  }

  if (!school) return res.json([]);

  try {
    let sql;
    let params;

    if (school === 'Dolphin PRELIMS' || (user && user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89')) {
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          'Dolphin PRELIMS' AS school,
          COUNT(s.id)::int AS submission_count
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89'
          AND u.role = 'STUDENT'
        GROUP BY u.id, u.name, u.username, u.grade
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 80
      `;
      params = [];
    } else if (school === 'KLN Vidyalaya CBSE Senior Secondary School' || (user && user.eventId === '0542016a-b443-421e-9ae0-a4787697b945')) {
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          'KLN Vidyalaya CBSE Senior Secondary School' AS school,
          COUNT(s.id)::int AS submission_count
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = '0542016a-b443-421e-9ae0-a4787697b945'
          AND u.role = 'STUDENT'
        GROUP BY u.id, u.name, u.username, u.grade
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 80
      `;
      params = [];
    } else {
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          sc.name AS school,
          COUNT(s.id)::int AS submission_count
        FROM "User" u
        JOIN "School" sc ON u."schoolId" = sc.id
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE u.role = 'STUDENT'
          AND sc.name = $1::text
          AND sc.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
        GROUP BY u.id, u.name, u.username, u.grade, sc.name
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 80
      `;
      params = [school];
    }

    const result = await query(sql, params);
    const scopedStudentId = getScopedStudentId(req, null);
    const rows = scopedStudentId
      ? result.rows.filter((row) => row.id === scopedStudentId)
      : result.rows;
    res.json(rows);
  } catch (err) {
    console.error('[pv/students-by-school]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/search?q=<name>[&school=<school_name>] ──────────────
router.get('/search', async (req, res) => {
  const q = nullify(req.query.q);
  const user = req.authUser;
  let school = getScopedSchool(req, nullify(req.query.school));

  if (user && user.role === 'event_admin' && user.eventId) {
    if (user.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
      school = 'KLN Vidyalaya CBSE Senior Secondary School';
    } else if (user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
      school = 'Dolphin PRELIMS';
    }
  }

  if (!q || q.length < 2) return res.json([]);
  try {
    let sql;
    let params;

    if (school === 'Dolphin PRELIMS' || (user && user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89')) {
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          'Dolphin PRELIMS' AS school
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        WHERE ue."eventId" = 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89'
          AND u.role = 'STUDENT'
          AND (
            LOWER(COALESCE(u.name,'')) LIKE LOWER($1)
            OR LOWER(u.username)       LIKE LOWER($1)
          )
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 20
      `;
      params = [`%${q}%`];
    } else if (school === 'KLN Vidyalaya CBSE Senior Secondary School' || (user && user.eventId === '0542016a-b443-421e-9ae0-a4787697b945')) {
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          'KLN Vidyalaya CBSE Senior Secondary School' AS school
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        WHERE ue."eventId" = '0542016a-b443-421e-9ae0-a4787697b945'
          AND u.role = 'STUDENT'
          AND (
            LOWER(COALESCE(u.name,'')) LIKE LOWER($1)
            OR LOWER(u.username)       LIKE LOWER($1)
          )
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 20
      `;
      params = [`%${q}%`];
    } else {
      const schoolClause = school ? `AND sc.name = $2::text` : '';
      params = school ? [`%${q}%`, school] : [`%${q}%`];
      sql = `
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS display_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          sc.name AS school
        FROM "User" u
        JOIN "School" sc ON u."schoolId" = sc.id
        WHERE u.role = 'STUDENT'
          AND sc.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
          AND (
            LOWER(COALESCE(u.name,'')) LIKE LOWER($1)
            OR LOWER(u.username)       LIKE LOWER($1)
          )
          ${schoolClause}
        ORDER BY COALESCE(u.name, u.username) ASC
        LIMIT 20
      `;
    }

    const result = await query(sql, params);
    const scopedStudentId = getScopedStudentId(req, null);
    const rows = scopedStudentId
      ? result.rows.filter((row) => row.id === scopedStudentId)
      : result.rows;
    res.json(rows);
  } catch (err) {
    console.error('[pv/search]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/profile?studentId=<id> ──────────────────────────
router.get('/profile', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        u.id,
        COALESCE(u.name, u.username) AS student_name,
        u.username,
        COALESCE(NULLIF(u.grade,''),'—') AS grade,
        COALESCE(sc.name, 'Dolphin PRELIMS') AS school,
        COALESCE(sc.name, 'Dolphin PRELIMS') AS zone,
        u."createdAt" AS joined_at,
        COUNT(s.id)::int AS total_submissions,
        COALESCE(SUM(s.score),0)::int AS total_score,
        ROUND(COALESCE(AVG(s.score),0)::numeric,1) AS avg_score,
        MAX(s.score)::int AS best_score,
        COUNT(DISTINCT COALESCE(s."challengeId", s.id))::int AS levels_attempted,
        1 AS rank_in_zone,
        1 AS total_in_zone,
        1 AS overall_rank,
        1 AS total_students_overall,
        0.0 AS zone_avg_score
      FROM "User" u
      LEFT JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id
      WHERE u.id = $1::text
      GROUP BY u.id, u.name, u.username, u.grade, sc.name, u."createdAt"
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[pv/profile]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/score-timeline?studentId=<id> ───────────────────
router.get('/score-timeline', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        s.id,
        COALESCE(s."challengeId", '1') AS level,
        s.score,
        s."createdAt",
        COALESCE((s.data::jsonb->>'timeTaken')::numeric, 0) AS time_taken_sec,
        COALESCE((s.data::jsonb->>'attempts')::numeric, 1) AS attempts
      FROM "Submission" s
      WHERE s."userId" = $1::text
      ORDER BY s."createdAt" ASC
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[pv/score-timeline]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/level-comparison?studentId=<id> ─────────────────
router.get('/level-comparison', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        1 AS level,
        COALESCE(ROUND(AVG(s.score)::numeric,1), 0) AS child_avg,
        COUNT(s.id)::int AS child_submissions,
        0 AS zone_avg,
        0 AS zone_submissions
      FROM "Submission" s
      WHERE s."userId" = $1::text
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[pv/level-comparison]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/recent-submissions?studentId=<id> ───────────────
router.get('/recent-submissions', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        s.id,
        COALESCE(s."challengeId", '1') AS level,
        s.score,
        s."createdAt",
        ROUND(COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0,1) AS time_taken_min,
        COALESCE((s.data::jsonb->>'attempts')::numeric,1)::int AS attempts,
        GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1)::int * -5 AS wrong_deduction,
        ROUND((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0)*-3,1) AS time_deduction
      FROM "Submission" s
      WHERE s."userId" = $1::text
      ORDER BY s."createdAt" DESC
      LIMIT 15
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[pv/recent-submissions]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/score-breakdown?studentId=<id> ──────────────────
router.get('/score-breakdown', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        ROUND(COALESCE(AVG(s.score),0)::numeric,1) AS avg_final_score,
        ROUND(COALESCE(AVG(GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * -5.0),0)::numeric,1) AS avg_wrong_deduction,
        ROUND(COALESCE(AVG((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * -3.0),0)::numeric,1) AS avg_time_deduction,
        ROUND(COALESCE(SUM(GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * 5.0),0)::numeric,1) AS total_wrong_loss,
        ROUND(COALESCE(SUM((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * 3.0),0)::numeric,1) AS total_time_loss,
        COUNT(s.id)::int AS total_submissions,
        ROUND(COALESCE(AVG(COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0),0)::numeric,1) AS avg_time_min,
        ROUND(COALESCE(AVG(COALESCE((s.data::jsonb->>'attempts')::numeric,1)),0)::numeric,2) AS avg_attempts
      FROM "Submission" s
      WHERE s."userId" = $1::text
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[pv/score-breakdown]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/milestones?studentId=<id> ───────────────────────
router.get('/milestones', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});

  const authorized = await verifyStudentBelongsToUser(req, studentId);
  if (!authorized) {
    return res.status(403).json({ error: 'Access denied: Student does not belong to authorized event' });
  }

  try {
    const sql = `
      SELECT
        COUNT(*)::int AS total_submissions,
        COALESCE(MAX(s.score),0)::int AS best_score,
        COUNT(DISTINCT COALESCE(s."challengeId", s.id))::int AS levels_attempted,
        COALESCE(SUM(s.score),0)::int AS total_score,
        COUNT(CASE WHEN s.score >= 90 THEN 1 END)::int AS count_90_plus,
        COUNT(CASE WHEN s.score >= 95 THEN 1 END)::int AS count_95_plus,
        COUNT(CASE WHEN s.score = 100 THEN 1 END)::int AS count_perfect,
        0::int AS level1_count,
        0::int AS level2_count,
        0::int AS level3_count,
        0::int AS level4_count
      FROM "Submission" s
      WHERE s."userId" = $1::text
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[pv/milestones]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
