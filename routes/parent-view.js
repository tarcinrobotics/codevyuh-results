/**
 * routes/parent-view.js
 * All API endpoints for /parent-view (Parent-facing student analytics)
 *
 * Scoring: Base 100, wrong attempt −5, time −3/min, hint −10, min 50
 * Schema: Submission(userId, level, score, data{timeTaken,attempts}), User(id, name, username, grade, schoolId), School(id,name)
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const { getScopedSchool, getScopedStudentId, filterSchoolsForUser } = require('../auth/access');
const EXCLUDED_SCHOOLS = ['Tarcin', 'ABC Matriculation School', 'XYZ Higher Secondary School'];

function nullify(v) {
  return (v === 'null' || v === '' || v === undefined || v === null) ? null : String(v);
}

// ── GET /api/parent-view/schools ──────────────────────────────────────────
// Return all schools for the dropdown
router.get('/schools', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name
      FROM "School"
      WHERE name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
      ORDER BY name ASC
    `);
    res.json(filterSchoolsForUser(req, result.rows, 'name'));
  } catch (err) {
    console.error('[pv/schools]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/students-by-school?school=<name> ─────────────────
// Return all students in a school (for auto-list on school selection)
router.get('/students-by-school', async (req, res) => {
  const school = getScopedSchool(req, nullify(req.query.school));
  if (!school) return res.json([]);
  try {
    const sql = `
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
    const result = await query(sql, [school]);
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
// Typeahead: return matching students (max 20), filtered by school if provided
router.get('/search', async (req, res) => {
  const q      = nullify(req.query.q);
  const school = getScopedSchool(req, nullify(req.query.school));
  if (!q || q.length < 2) return res.json([]);
  try {
    const schoolClause = school
      ? `AND sc.name = $2::text`
      : '';
    const params = school ? [`%${q}%`, school] : [`%${q}%`];
    const sql = `
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
// Student KPI profile row
router.get('/profile', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});
  try {
    const sql = `
      WITH school_avg AS (
        SELECT
          u2."schoolId",
          AVG(s2.score) AS school_avg_score
        FROM "Submission" s2
        JOIN "User" u2 ON s2."userId" = u2.id
        JOIN "School" sc2 ON u2."schoolId" = sc2.id
        WHERE u2.role = 'STUDENT'
          AND sc2.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
        GROUP BY u2."schoolId"
      ),
      student_stats AS (
        SELECT
          u.id,
          COALESCE(u.name, u.username) AS student_name,
          u.username,
          COALESCE(NULLIF(u.grade,''),'—') AS grade,
          sc.name AS school,
          u."createdAt" AS joined_at,
          COUNT(s.id)::int AS total_submissions,
          COALESCE(SUM(s.score),0)::int AS total_score,
          ROUND(COALESCE(AVG(s.score),0)::numeric,1) AS avg_score,
          MAX(s.score)::int AS best_score,
          COUNT(DISTINCT s.level)::int AS levels_attempted
        FROM "User" u
        JOIN "School" sc ON u."schoolId" = sc.id
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE u.id = $1::text
        GROUP BY u.id, u.name, u.username, u.grade, sc.name, u."createdAt"
      ),
      school_rank AS (
        SELECT
          u3.id,
          RANK() OVER (
            PARTITION BY u3."schoolId"
            ORDER BY COALESCE(SUM(s3.score),0) DESC
          )::int AS rank_in_school,
          COUNT(*) OVER (PARTITION BY u3."schoolId")::int AS total_in_zone
        FROM "User" u3
        JOIN "School" sc3 ON u3."schoolId" = sc3.id
        LEFT JOIN "Submission" s3 ON s3."userId" = u3.id
        WHERE u3.role = 'STUDENT'
          AND sc3.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
        GROUP BY u3.id, u3."schoolId"
      ),
      overall_rank AS (
        SELECT
          u5.id,
          RANK() OVER (
            ORDER BY COALESCE(SUM(s5.score),0) DESC
          )::int AS overall_rank,
          COUNT(*) OVER ()::int AS total_students_overall
        FROM "User" u5
        JOIN "School" sc5 ON u5."schoolId" = sc5.id
        LEFT JOIN "Submission" s5 ON s5."userId" = u5.id
        WHERE u5.role = 'STUDENT'
          AND sc5.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
        GROUP BY u5.id
      )
      SELECT
        ss.*,
        sr.rank_in_school AS rank_in_zone,
        sr.total_in_zone,
        orr.overall_rank,
        orr.total_students_overall,
        ss.school AS zone,
        ROUND(sa.school_avg_score::numeric,1) AS zone_avg_score
      FROM student_stats ss
      LEFT JOIN school_rank sr ON sr.id = ss.id
      LEFT JOIN overall_rank orr ON orr.id = ss.id
      LEFT JOIN "User" u4 ON u4.id = ss.id
      LEFT JOIN school_avg sa ON sa."schoolId" = u4."schoolId"
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows[0] ?? {});
  } catch (err) {
    console.error('[pv/profile]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/score-timeline?studentId=<id> ───────────────────
// All submissions in chronological order for the line chart
router.get('/score-timeline', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);
  try {
    const sql = `
      SELECT
        s.id,
        s.level,
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
// Child avg score per level vs zone avg per level
router.get('/level-comparison', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);
  try {
    const sql = `
      WITH student_school AS (
        SELECT "schoolId" FROM "User" WHERE id = $1::text
      ),
      child_stats AS (
        SELECT
          s.level,
          ROUND(AVG(s.score)::numeric,1) AS child_avg,
          COUNT(*)::int AS child_submissions
        FROM "Submission" s
        WHERE s."userId" = $1::text
        GROUP BY s.level
      ),
      zone_stats AS (
        SELECT
          s.level,
          ROUND(AVG(s.score)::numeric,1) AS zone_avg,
          COUNT(*)::int AS zone_submissions
        FROM "Submission" s
        JOIN "User" u ON s."userId" = u.id
        WHERE u."schoolId" = (SELECT "schoolId" FROM student_school)
          AND u.role = 'STUDENT'
        GROUP BY s.level
      )
      SELECT
        COALESCE(cs.level, zs.level) AS level,
        COALESCE(cs.child_avg, 0) AS child_avg,
        COALESCE(cs.child_submissions, 0) AS child_submissions,
        COALESCE(zs.zone_avg, 0) AS zone_avg,
        COALESCE(zs.zone_submissions, 0) AS zone_submissions
      FROM child_stats cs
      FULL OUTER JOIN zone_stats zs ON zs.level = cs.level
      ORDER BY level ASC
    `;
    const result = await query(sql, [studentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[pv/level-comparison]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/parent-view/recent-submissions?studentId=<id> ───────────────
// Last 15 submissions with full detail
router.get('/recent-submissions', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json([]);
  try {
    const sql = `
      SELECT
        s.id,
        s.level,
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
// Avg deduction breakdown per level for the donut
router.get('/score-breakdown', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});
  try {
    const sql = `
      SELECT
        ROUND(AVG(s.score)::numeric,1) AS avg_final_score,
        ROUND(AVG(
          GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * -5.0
        )::numeric,1) AS avg_wrong_deduction,
        ROUND(AVG(
          (COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * -3.0
        )::numeric,1) AS avg_time_deduction,
        ROUND(SUM(
          GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric,1)-1) * 5.0
        )::numeric,1) AS total_wrong_loss,
        ROUND(SUM(
          (COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0) * 3.0
        )::numeric,1) AS total_time_loss,
        COUNT(*)::int AS total_submissions,
        ROUND(AVG(COALESCE((s.data::jsonb->>'timeTaken')::numeric,0)/60.0)::numeric,1) AS avg_time_min,
        ROUND(AVG(COALESCE((s.data::jsonb->>'attempts')::numeric,1))::numeric,2) AS avg_attempts
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
// Milestone data for the achievement tracker
router.get('/milestones', async (req, res) => {
  const studentId = getScopedStudentId(req, nullify(req.query.studentId));
  if (!studentId) return res.json({});
  try {
    const sql = `
      SELECT
        COUNT(*)::int AS total_submissions,
        MAX(s.score)::int AS best_score,
        COUNT(DISTINCT s.level)::int AS levels_attempted,
        COALESCE(SUM(s.score),0)::int AS total_score,
        COUNT(CASE WHEN s.score >= 90 THEN 1 END)::int AS count_90_plus,
        COUNT(CASE WHEN s.score >= 95 THEN 1 END)::int AS count_95_plus,
        COUNT(CASE WHEN s.score = 100 THEN 1 END)::int AS count_perfect,
        COUNT(CASE WHEN s.level = 1 THEN 1 END)::int AS level1_count,
        COUNT(CASE WHEN s.level = 2 THEN 1 END)::int AS level2_count,
        COUNT(CASE WHEN s.level = 3 THEN 1 END)::int AS level3_count,
        COUNT(CASE WHEN s.level = 4 THEN 1 END)::int AS level4_count
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
