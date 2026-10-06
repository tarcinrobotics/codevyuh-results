/**
 * routes/admin-overview.js
 * All API endpoints for the /admin-overview dashboard.
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const Q = require('../queries/admin-overview.json');
const { getScopedSchool, filterSchoolsForUser } = require('../auth/access');

// ── Helper ─────────────────────────────────────────────────────────────────
function nullify(val) {
  return (val === 'null' || val === '' || val === undefined || val === null)
    ? null : String(val);
}

/**
 * Fetch all school performance data and classify schools as active / inactive.
 * Active  = submissions AND total_score both >= median
 * Inactive = submissions OR total_score below median
 *
 * Returns a Set of school names that match the requested status.
 * If status is null, returns null (meaning no status filter applied).
 */
async function getStatusZoneSet(status, zoneFilter) {
  if (!status) return null;

  const result = await query(Q.zonePerformance, [null]); // all schools, unfiltered
  const rows   = result.rows;
  if (!rows.length) return new Set();

  // Compute medians for robustness.
  const subsCopy  = rows.map(r => parseInt(r.submissions) || 0).sort((a, b) => a - b);
  const scoreCopy = rows.map(r => parseInt(r.total_score) || 0).sort((a, b) => a - b);
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
      (parseInt(r.submissions) || 0) >= medianSubs &&
      (parseInt(r.total_score)  || 0) >= medianScore
    );
  } else {
    filtered = rows.filter(r =>
      (parseInt(r.submissions) || 0) < medianSubs ||
      (parseInt(r.total_score)  || 0) < medianScore
    );
  }

  return new Set(filtered.map(r => r.zone));
}

/**
 * Post-filter an array of rows by school name against the status set.
 */
function applyStatusFilter(rows, zoneSet, key = 'zone') {
  if (!zoneSet) return rows;
  return rows.filter(r => zoneSet.has(r[key]));
}

// ── GET /api/admin-overview/filters ───────────────────────────────────────
router.get('/filters', async (req, res) => {
  try {
    const zones = await query(Q.filters.zones);
    const visible = filterSchoolsForUser(req, zones.rows, 'zone');
    res.json({
      zones: visible.map(r => r.zone),
    });
  } catch (err) {
    console.error('[filters]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin-overview/summary ───────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const scopedZone = getScopedSchool(req, nullify(req.query.zone));
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
    const result = await query(sql, [scopedZone]);
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
    const zone   = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.zonePerformance, [zone]),
      getStatusZoneSet(status, zone),
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
    const zone   = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.progressBands, [zone]),
      getStatusZoneSet(status, zone),
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
    const zone   = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.scoringBreakdown, [zone]),
      getStatusZoneSet(status, zone),
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
    const zone   = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.zoneScoreRanges, [zone]),
      getStatusZoneSet(status, zone),
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
    const zone   = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.topPerformingZones, [zone]),
      getStatusZoneSet(status, zone),
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
    const zone = getScopedSchool(req, nullify(req.query.zone));
    const status = nullify(req.query.status);

    const [result, zoneSet] = await Promise.all([
      query(Q.topStudents, [zone]),
      getStatusZoneSet(status, zone),
    ]);

    const rows = applyStatusFilter(result.rows, zoneSet, 'school').slice(0, 3);
    res.json(rows);
  } catch (err) {
    console.error('[top-students]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
