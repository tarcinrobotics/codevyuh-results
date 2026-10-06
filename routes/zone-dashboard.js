/**
 * routes/zone-dashboard.js
 * All API endpoints for the /zone-dashboard page.
 * Supports optional filters: zone, level, grade, status
 *
 * Schema:
 *   School.name → zone
 *   Submission  → userId, level, score, data(json), createdAt
 *   User        → schoolId, name, username, grade, role
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const Q = require('../queries/zone-dashboard.json');
const { getScopedSchool, filterSchoolsForUser } = require('../auth/access');
const EXCLUDED_ZONES = ['Tarcin', 'ABC Matriculation School', 'XYZ Higher Secondary School'];

function nullify(val) {
  return (val === 'null' || val === '' || val === undefined || val === null)
    ? null : String(val);
}

function getF(req) {
  return {
    zone:   getScopedSchool(req, nullify(req.query.zone)),
    level:  nullify(req.query.level),
    grade:  nullify(req.query.grade),
    status: nullify(req.query.status),  // 'active' | 'inactive' | null
  };
}

// Safe grade string — prevent SQL injection
function safeGrade(g) {
  return g ? g.replace(/'/g, "''") : null;
}

function isExcludedZone(zone) {
  return !!zone && EXCLUDED_ZONES.includes(zone);
}

// ── GET /api/zone-dashboard/zones ────────────────────────────────────────
router.get('/zones', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name AS zone
       FROM "School"
       WHERE name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
       ORDER BY name ASC`
    );
    const visible = filterSchoolsForUser(req, result.rows, 'zone');
    res.json(visible.map(r => ({ id: r.id, name: r.zone })));
  } catch (err) {
    console.error('[zd/zones]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/summary ──────────────────────────────────────
router.get('/summary', async (req, res) => {
  const { zone, level, status } = getF(req);
  if (isExcludedZone(zone)) return res.json({});
  if (!zone) return res.json({});
  try {
    const lvlJoin  = level  ? `AND s.level = ${parseInt(level)}` : '';
    const statWhere = status === 'active'   ? 'AND s.id IS NOT NULL'
                    : status === 'inactive' ? 'AND s.id IS NULL' : '';
    const sql = `
      SELECT
        COUNT(DISTINCT u.id)::int AS total_students,
        COUNT(s.id)::int AS total_submissions,
        COALESCE(SUM(s.score),0)::bigint AS total_score,
        COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN u.id END)::int AS active_students
      FROM "School" sc
      LEFT JOIN "User" u ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id ${lvlJoin}
      WHERE sc.name = $1::text AND u.role = 'STUDENT' ${statWhere}
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[zd/summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/top-students ─────────────────────────────────
router.get('/top-students', async (req, res) => {
  const { zone, level, grade, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const lvlJoin   = level ? `AND s.level = ${parseInt(level)}` : '';
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const having     = status === 'active'   ? 'HAVING COUNT(s.id) > 0'
                     : status === 'inactive' ? 'HAVING COUNT(s.id) = 0' : '';
    const sql = `
      SELECT
        COALESCE(u.name, u.username) AS student_name,
        u.grade,
        COUNT(s.id)::int AS submissions,
        COALESCE(SUM(s.score),0)::int AS total_score,
        MAX(s.score)::int AS best_score
      FROM "User" u
      JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id ${lvlJoin}
      WHERE sc.name = $1::text AND u.role = 'STUDENT' ${gradeWhere}
      GROUP BY u.id, u.name, u.username, u.grade
      ${having}
      ORDER BY total_score DESC NULLS LAST
      LIMIT 15
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/top-students]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/level-breakdown ───────────────────────────────
router.get('/level-breakdown', async (req, res) => {
  const { zone, level, grade } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const lvlWhere   = level ? `AND s.level = ${parseInt(level)}` : '';
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const sql = `
      SELECT
        s.level,
        COUNT(*)::int AS submissions,
        COALESCE(SUM(s.score),0)::bigint AS total_score,
        ROUND(AVG(COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0)::numeric,2) AS avg_time_min,
        ROUND(AVG(GREATEST(0,COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1)*-5.0)::numeric,2) AS avg_wrong_deduction,
        ROUND(AVG((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0)*-3.0)::numeric,2) AS avg_time_deduction
      FROM "Submission" s
      JOIN "User" u ON s."userId" = u.id
      JOIN "School" sc ON u."schoolId" = sc.id
      WHERE sc.name = $1::text ${lvlWhere} ${gradeWhere}
      GROUP BY s.level
      ORDER BY s.level ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/level-breakdown]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/score-distribution ───────────────────────────
router.get('/score-distribution', async (req, res) => {
  const { zone, grade, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const having     = status === 'active'   ? 'HAVING COALESCE(SUM(s.score),0) > 0'
                     : status === 'inactive' ? 'HAVING COALESCE(SUM(s.score),0) = 0' : '';
    const sql = `
      WITH student_totals AS (
        SELECT u.id, COALESCE(SUM(s.score),0) AS total
        FROM "User" u
        JOIN "School" sc ON u."schoolId" = sc.id
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE sc.name = $1::text AND u.role = 'STUDENT' ${gradeWhere}
        GROUP BY u.id
        ${having}
      )
      SELECT
        CASE
          WHEN total = 0    THEN 'No submissions'
          WHEN total < 100  THEN '1 – 100'
          WHEN total < 300  THEN '100 – 300'
          WHEN total < 500  THEN '300 – 500'
          WHEN total < 1000 THEN '500 – 1K'
          WHEN total < 2000 THEN '1K – 2K'
          WHEN total < 5000 THEN '2K – 5K'
          ELSE '5K+'
        END AS score_range,
        COUNT(*)::int AS student_count
      FROM student_totals
      GROUP BY score_range
      ORDER BY MIN(total) ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/score-distribution]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/score-milestones ─────────────────────────────
router.get('/score-milestones', async (req, res) => {
  const { zone, level, grade, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const lvlWhere   = level ? `AND s.level = ${parseInt(level)}` : '';
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const having = status === 'active'
      ? 'HAVING COUNT(s.id) > 0'
      : status === 'inactive'
        ? 'HAVING COUNT(s.id) = 0'
        : '';
    const sql = `
      SELECT
        COALESCE(NULLIF(u.grade,''),'Unknown') AS grade,
        COUNT(s.id)::int AS submissions,
        COUNT(*) FILTER (WHERE s.score >= 90)::int AS score_90_plus,
        COUNT(*) FILTER (WHERE s.score = 100)::int AS perfect_scores
      FROM "User" u
      JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id ${lvlWhere}
      WHERE sc.name = $1::text
        AND u.role = 'STUDENT'
        ${gradeWhere}
      GROUP BY u.grade
      ${having}
      ORDER BY submissions DESC NULLS LAST, grade ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/score-milestones]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/score-bands ────────────────────────────────
router.get('/score-bands', async (req, res) => {
  const { zone, grade, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const having     = status === 'active'   ? 'HAVING COALESCE(SUM(s.score),0) > 0'
                     : status === 'inactive' ? 'HAVING COALESCE(SUM(s.score),0) = 0' : '';
    const sql = `
      WITH student_totals AS (
        SELECT
          COALESCE(NULLIF(u.grade,''),'Unknown') AS grade,
          u.id,
          COALESCE(SUM(s.score),0) AS total_score
        FROM "User" u
        JOIN "School" sc ON u."schoolId" = sc.id
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE sc.name = $1::text AND u.role = 'STUDENT' ${gradeWhere}
        GROUP BY u.id, u.grade
        ${having}
      )
      SELECT
        grade,
        COUNT(*) FILTER (WHERE total_score = 0)::int AS zero_band,
        COUNT(*) FILTER (WHERE total_score > 0 AND total_score < 300)::int AS emerging_band,
        COUNT(*) FILTER (WHERE total_score >= 300 AND total_score < 1000)::int AS progressing_band,
        COUNT(*) FILTER (WHERE total_score >= 1000)::int AS advanced_band
      FROM student_totals
      GROUP BY grade
      ORDER BY grade ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/score-bands]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/deduction-overview ─────────────────────────
router.get('/deduction-overview', async (req, res) => {
  const { zone, grade, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const statusWhere = status === 'active'   ? 'AND s.id IS NOT NULL'
                      : status === 'inactive' ? 'AND s.id IS NULL' : '';
    const sql = `
      SELECT
        COALESCE(NULLIF(u.grade,''),'Unknown') AS grade,
        ROUND(SUM(GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * 5.0)::numeric,1) AS wrong_loss,
        ROUND(SUM((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * 3.0)::numeric,1) AS pace_loss,
        COUNT(s.id)::int AS submissions
      FROM "User" u
      JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id
      WHERE sc.name = $1::text
        AND u.role = 'STUDENT'
        ${gradeWhere}
        ${statusWhere}
      GROUP BY u.grade
      ORDER BY (COALESCE(SUM(GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * 5.0),0)
              + COALESCE(SUM((COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * 3.0),0)) DESC,
               grade ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/deduction-overview]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/gradewise-stats ──────────────────────────────
router.get('/gradewise-stats', async (req, res) => {
  const { zone, grade, level, status } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const lvlJoin    = level ? `AND s.level = ${parseInt(level)}` : '';
    const having     = status === 'active'   ? 'HAVING COUNT(s.id) > 0'
                     : status === 'inactive' ? 'HAVING COUNT(s.id) = 0' : '';
    const sql = `
      SELECT
        COALESCE(NULLIF(u.grade,''),'Unknown') AS grade,
        COUNT(DISTINCT u.id)::int AS students,
        COUNT(s.id)::int AS submissions,
        COALESCE(SUM(s.score),0)::bigint AS total_score
      FROM "User" u
      JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id ${lvlJoin}
      WHERE sc.name = $1::text AND u.role = 'STUDENT' ${gradeWhere}
      GROUP BY u.grade
      ${having}
      ORDER BY total_score DESC NULLS LAST
      LIMIT 12
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/gradewise-stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/inactive-students ─────────────────────────────
// Students in this zone with ZERO submissions
router.get('/inactive-students', async (req, res) => {
  const { zone, grade } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const sql = `
      SELECT
        COALESCE(u.name, u.username) AS student_name,
        u.username,
        COALESCE(NULLIF(u.grade,''),'—') AS grade,
        u."createdAt" AS joined_at
      FROM "User" u
      JOIN "School" sc ON u."schoolId" = sc.id
      LEFT JOIN "Submission" s ON s."userId" = u.id
      WHERE sc.name = $1::text AND u.role = 'STUDENT' ${gradeWhere}
      GROUP BY u.id, u.name, u.username, u.grade, u."createdAt"
      HAVING COUNT(s.id) = 0
      ORDER BY u."createdAt" DESC NULLS LAST
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/inactive-students]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/zone-rank ─────────────────────────────────────
// All zones ranked by total_score; highlights the selected zone's position
router.get('/zone-rank', async (req, res) => {
  const { zone } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const result = await query(Q.zoneRank);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/zone-rank]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/zone-rank-summary ─────────────────────────────
// Returns the selected zone's rank as rank / total_zones
router.get('/zone-rank-summary', async (req, res) => {
  const { zone } = getF(req);
  if (isExcludedZone(zone)) return res.json({});
  if (!zone) return res.json({});
  try {
    const result = await query(Q.zoneRankSummary, [zone]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[zd/zone-rank-summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/zone-dashboard/level-proficiency ─────────────────────────────
// Per-grade: total score, submissions, and activity minutes
router.get('/level-proficiency', async (req, res) => {
  const { zone, grade } = getF(req);
  if (isExcludedZone(zone)) return res.json([]);
  if (!zone) return res.json([]);
  try {
    const gradeWhere = grade ? `AND u.grade = '${safeGrade(grade)}'` : '';
    const sql = `
      SELECT
        COALESCE(NULLIF(u.grade,''),'Unknown') AS grade,
        COALESCE(SUM(s.score),0)::bigint AS total_score,
        COUNT(*)::int AS total_submissions,
        ROUND(SUM(COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0)::numeric,1) AS total_time_min,
        ROUND(AVG(COALESCE((s.data::jsonb->>'attempts')::numeric,1))::numeric,2) AS avg_attempts
      FROM "Submission" s
      JOIN "User" u ON s."userId" = u.id
      JOIN "School" sc ON u."schoolId" = sc.id
      WHERE sc.name = $1::text ${gradeWhere}
      GROUP BY u.grade
      ORDER BY total_score DESC NULLS LAST, grade ASC
    `;
    const result = await query(sql, [zone]);
    res.json(result.rows);
  } catch (err) {
    console.error('[zd/level-proficiency]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
