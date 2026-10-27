/**
 * routes/admin-overview.js
 * All API endpoints for the /admin-overview dashboard.
 * Supports event isolation for KLN PRELIMS and Dolphin PRELIMS.
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const Q = require('../queries/admin-overview.json');
const { getScopedSchool, filterSchoolsForUser } = require('../auth/access');

const ZONE_TO_EVENT = {
  'KLN Vidyalaya CBSE Senior Secondary School': '0542016a-b443-421e-9ae0-a4787697b945',
  'KLN PRELIMS': '0542016a-b443-421e-9ae0-a4787697b945',
  'Dolphin PRELIMS': 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89',
};

const EVENT_TO_ZONE = {
  '0542016a-b443-421e-9ae0-a4787697b945': 'KLN Vidyalaya CBSE Senior Secondary School',
  'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89': 'Dolphin PRELIMS',
};

// ── Helper ─────────────────────────────────────────────────────────────────
function nullify(val) {
  return (val === 'null' || val === '' || val === undefined || val === null)
    ? null : String(val);
}

function resolveEventContext(req) {
  const user = req.authUser;
  if (user && user.role === 'event_admin' && user.eventId) {
    const zoneName = EVENT_TO_ZONE[user.eventId] || 'Scoped Event';
    return { eventId: user.eventId, zoneName };
  }
  const scopedZone = getScopedSchool(req, nullify(req.query.zone));
  if (scopedZone && ZONE_TO_EVENT[scopedZone]) {
    return { eventId: ZONE_TO_EVENT[scopedZone], zoneName: scopedZone };
  }
  return { eventId: null, zoneName: scopedZone };
}

/**
 * Fetch all school performance data and classify schools as active / inactive.
 */
async function getStatusZoneSet(status, zoneFilter) {
  if (!status) return null;

  const result = await query(Q.zonePerformance, [null]);
  const rows   = result.rows;
  if (!rows.length) return new Set();

  const subsCopy  = rows.map(r => parseInt(r.submissions, 10) || 0).sort((a, b) => a - b);
  const scoreCopy = rows.map(r => parseInt(r.total_score, 10) || 0).sort((a, b) => a - b);
  const mid       = Math.floor(rows.length / 2);
  const medianSubs  = rows.length % 2 === 0
    ? (subsCopy[mid - 1] + subsCopy[mid]) / 2
    : subsCopy[mid];
  const medianScore = rows.length % 2 === 0
    ? (scoreCopy[mid - 1] + scoreCopy[mid]) / 2
    : scoreCopy[mid];

  let filtered;
  if (status === 'active') {
    filtered = rows.filter(r =>
      (parseInt(r.submissions, 10) || 0) >= medianSubs &&
      (parseInt(r.total_score, 10)  || 0) >= medianScore
    );
  } else {
    filtered = rows.filter(r =>
      (parseInt(r.submissions, 10) || 0) < medianSubs ||
      (parseInt(r.total_score, 10)  || 0) < medianScore
    );
  }

  return new Set(filtered.map(r => r.zone));
}

function applyStatusFilter(rows, zoneSet, key = 'zone') {
  if (!zoneSet) return rows;
  return rows.filter(r => zoneSet.has(r[key]));
}

// ── GET /api/admin-overview/filters ───────────────────────────────────────
router.get('/filters', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (req.authUser && req.authUser.role === 'event_admin') {
      return res.json({ zones: [zoneName] });
    }

    const zones = await query(Q.filters.zones);
    const visible = filterSchoolsForUser(req, zones.rows, 'zone');
    const zoneList = visible.map(r => r.zone);
    if (!zoneList.includes('Dolphin PRELIMS')) {
      zoneList.push('Dolphin PRELIMS');
    }
    res.json({
      zones: zoneList,
    });
  } catch (err) {
    console.error('[filters]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/summary ───────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    let result;

    if (eventId) {
      const sql = `
        WITH scoped_students AS (
          SELECT u.id
          FROM "User" u
          JOIN "UserEvent" ue ON ue."userId" = u.id
          WHERE ue."eventId" = $1::text AND u.role = 'STUDENT'
        )
        SELECT
          (SELECT COUNT(*)::int FROM scoped_students) AS total_students,
          (
            SELECT ROUND(
              100.0 * COUNT(DISTINCT s."userId") / NULLIF((SELECT COUNT(*) FROM scoped_students), 0),
              2
            )
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS participation_rate,
          (
            SELECT COUNT(*)::int
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS total_submissions,
          (
            SELECT COALESCE(SUM(s.score),0)::bigint
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS total_score
      `;
      result = await query(sql, [eventId]);
    } else {
      const sql = `
        WITH scoped_students AS (
          SELECT u.id
          FROM "User" u
          JOIN "School" sc ON u."schoolId" = sc.id
          WHERE sc.name NOT IN ('Tarcin','ABC Matriculation School','XYZ Higher Secondary School')
            AND ($1::text IS NULL OR sc.name = $1::text)
        )
        SELECT
          (SELECT COUNT(*)::int FROM scoped_students) AS total_students,
          (
            SELECT ROUND(
              100.0 * COUNT(DISTINCT s."userId") / NULLIF((SELECT COUNT(*) FROM scoped_students), 0),
              2
            )
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS participation_rate,
          (
            SELECT COUNT(*)::int
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS total_submissions,
          (
            SELECT COALESCE(SUM(s.score),0)::bigint
            FROM "Submission" s
            WHERE s."userId" IN (SELECT id FROM scoped_students)
          ) AS total_score
      `;
      result = await query(sql, [zoneName]);
    }

    const summary = result.rows[0] || {};
    const totalStudents = Number(summary.total_students ?? 0);
    const totalSubmissions = Number(summary.total_submissions ?? 0);
    const participationRate = summary.participation_rate ?? '0.00';
    const activeStudents = Math.round((parseFloat(participationRate) / 100) * totalStudents);
    const submissionsPerActiveStudent = activeStudents > 0
      ? (totalSubmissions / activeStudents).toFixed(2)
      : '0.00';

    res.json({
      totalStudents,
      participationRate,
      totalSubmissions,
      activeStudents,
      submissionsPerActiveStudent,
      totalScore: summary.total_score ?? 0,
    });
  } catch (err) {
    console.error('[summary]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/zone-performance ──────────────────────────────
router.get('/zone-performance', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        SELECT
          $2::text AS zone,
          COUNT(DISTINCT u.id)::int AS student_count,
          COUNT(s.id)::int AS submissions,
          COALESCE(SUM(s.score), 0)::bigint AS total_score
        FROM "UserEvent" ue
        JOIN "User" u ON ue."userId" = u.id AND u.role = 'STUDENT'
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = $1::text
      `;
      const result = await query(sql, [eventId, zoneName]);
      return res.json(result.rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.zonePerformance, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'zone');
    res.json(rows);
  } catch (err) {
    console.error('[zone-performance]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/progress-bands ────────────────────────────────
router.get('/progress-bands', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        WITH student_totals AS (
          SELECT
            $2::text AS zone,
            u.id AS student_id,
            COALESCE(SUM(s.score), 0) AS total_score
          FROM "UserEvent" ue
          JOIN "User" u ON ue."userId" = u.id AND u.role = 'STUDENT'
          LEFT JOIN "Submission" s ON s."userId" = u.id
          WHERE ue."eventId" = $1::text
          GROUP BY u.id
        )
        SELECT
          zone,
          COUNT(*) FILTER (WHERE student_id IS NOT NULL AND total_score = 0)::int AS no_submission_count,
          COUNT(*) FILTER (WHERE total_score > 0 AND total_score < 300)::int AS emerging_count,
          COUNT(*) FILTER (WHERE total_score >= 300 AND total_score < 1000)::int AS progressing_count,
          COUNT(*) FILTER (WHERE total_score >= 1000)::int AS advanced_count
        FROM student_totals
        GROUP BY zone
      `;
      const result = await query(sql, [eventId, zoneName]);
      return res.json(result.rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.progressBands, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'zone');
    res.json(rows);
  } catch (err) {
    console.error('[progress-bands]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/scoring-breakdown ─────────────────────────────
router.get('/scoring-breakdown', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        SELECT
          $2::text AS zone,
          COALESCE(SUM(s.score), 0)::bigint AS total_score,
          ROUND(COALESCE(SUM(GREATEST(0, COALESCE((s.data::jsonb->>'attempts')::numeric, 1) - 1) * 5.0), 0)::numeric, 2) AS total_wrong_deduction,
          ROUND(COALESCE(SUM((COALESCE((s.data::jsonb->>'timeTaken')::numeric, 0) / 60.0) * 3.0), 0)::numeric, 2) AS total_time_deduction,
          0.0 AS total_hint_deduction,
          COUNT(s.id)::int AS submissions
        FROM "UserEvent" ue
        JOIN "User" u ON ue."userId" = u.id
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = $1::text AND s.score IS NOT NULL
      `;
      const result = await query(sql, [eventId, zoneName]);
      const rows = result.rows.length && Number(result.rows[0].submissions) > 0
        ? result.rows
        : [{
            zone: zoneName,
            total_score: 0,
            total_wrong_deduction: 0,
            total_time_deduction: 0,
            total_hint_deduction: 0,
            submissions: 0
          }];
      return res.json(rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.scoringBreakdown, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'zone');
    res.json(rows);
  } catch (err) {
    console.error('[scoring-breakdown]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/zone-score-ranges ─────────────────────────────
router.get('/zone-score-ranges', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        WITH zone_totals AS (
          SELECT
            $2::text AS zone,
            COALESCE(SUM(s.score), 0) AS total_score
          FROM "UserEvent" ue
          JOIN "User" u ON ue."userId" = u.id
          LEFT JOIN "Submission" s ON s."userId" = u.id
          WHERE ue."eventId" = $1::text
        )
        SELECT
          zone,
          total_score,
          CASE
            WHEN total_score < 5000 THEN '0 – 5K'
            WHEN total_score < 20000 THEN '5K – 20K'
            WHEN total_score < 50000 THEN '20K – 50K'
            WHEN total_score < 100000 THEN '50K – 100K'
            WHEN total_score < 250000 THEN '100K – 250K'
            WHEN total_score < 500000 THEN '250K – 500K'
            ELSE '500K+'
          END AS score_range
        FROM zone_totals
        GROUP BY zone, total_score
      `;
      const result = await query(sql, [eventId, zoneName]);
      return res.json(result.rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.zoneScoreRanges, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'zone');
    res.json(rows);
  } catch (err) {
    console.error('[zone-score-ranges]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/top-zones ────────────────────────────────────
router.get('/top-zones', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        SELECT
          $2::text AS zone,
          COUNT(DISTINCT u.id)::int AS total_members,
          COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN u.id END)::int AS active_members,
          (COUNT(DISTINCT u.id) - COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN u.id END))::int AS inactive_members,
          ROUND(100.0 * COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN u.id END) / NULLIF(COUNT(DISTINCT u.id), 0), 1) AS activity_rate,
          COALESCE(SUM(s.score), 0)::bigint AS total_score
        FROM "UserEvent" ue
        JOIN "User" u ON ue."userId" = u.id AND u.role = 'STUDENT'
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = $1::text
      `;
      const result = await query(sql, [eventId, zoneName]);
      return res.json(result.rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.topPerformingZones, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'zone');
    res.json(rows);
  } catch (err) {
    console.error('[top-zones]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/top-students ────────────────────────────────
router.get('/top-students', async (req, res) => {
  try {
    const { eventId, zoneName } = resolveEventContext(req);
    if (eventId) {
      const sql = `
        SELECT
          COALESCE(u.name, u.username) AS student_name,
          COALESCE(NULLIF(u.grade,''), 'Unknown') AS grade,
          $2::text AS school,
          COALESCE(SUM(s.score), 0)::bigint AS total_score
        FROM "UserEvent" ue
        JOIN "User" u ON ue."userId" = u.id AND u.role = 'STUDENT'
        LEFT JOIN "Submission" s ON s."userId" = u.id
        WHERE ue."eventId" = $1::text
        GROUP BY u.id, u.name, u.username, u.grade
        HAVING COALESCE(SUM(s.score), 0) > 0
        ORDER BY total_score DESC NULLS LAST, student_name ASC
        LIMIT 3
      `;
      const result = await query(sql, [eventId, zoneName]);
      return res.json(result.rows);
    }

    const status = nullify(req.query.status);
    const [result, zoneSet] = await Promise.all([
      query(Q.topStudents, [zoneName]),
      getStatusZoneSet(status, zoneName),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'school').slice(0, 3);
    res.json(rows);
  } catch (err) {
    console.error('[top-students]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
