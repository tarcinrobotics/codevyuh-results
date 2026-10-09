/**
 * routes/event-insights.js
 * API endpoints for Event Insights dashboard
 * Enforces event-level permissions and displays KLN PRELIMS and Dolphin PRELIMS
 */

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { getLiveDatabaseStatus } = require('../db-supervisor');

const EVENT_DISPLAY_NAMES = {
  '0542016a-b443-421e-9ae0-a4787697b945': 'KLN PRELIMS',
  'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89': 'Dolphin PRELIMS',
};

function formatEventRow(row) {
  if (!row) return row;
  const displayName = EVENT_DISPLAY_NAMES[row.id] || row.name;
  return {
    ...row,
    name: displayName,
    display_name: displayName,
  };
}

function handleDbError(res, err, action) {
  console.error(`[Event Insights] ${action} error:`, err.message || err);
  const isDbDown = 
    err.code === 'ECONNREFUSED' || 
    err.code === 'ECONNRESET' || 
    err.code === '57P03' || 
    (err.message && (
      err.message.includes('Connection terminated') ||
      err.message.includes('starting up') ||
      err.message.includes('timeout')
    ));

  if (isDbDown) {
    return res.status(503).json({
      error: 'Database is currently unavailable or recovering. Please retry shortly.',
      code: 'DB_UNAVAILABLE',
      details: err.message,
    });
  }

  return res.status(500).json({
    error: `Failed to ${action}`,
    details: err.message,
  });
}

function authorizeEventParam(req, res, next) {
  const user = req.authUser;
  const eventId = req.params.id;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (user.role !== 'super_admin' && user.eventId && user.eventId !== eventId) {
    return res.status(403).json({ error: 'Access denied: You do not have permission to access this event' });
  }
  next();
}

/**
 * GET /api/event-insights/health
 * Returns dedicated database health check for Event Insights subsystem.
 */
router.get('/health', async (req, res) => {
  const status = await getLiveDatabaseStatus();
  res.status(status.isReady ? 200 : 503).json({
    status: status.isReady ? 'healthy' : 'degraded',
    postgres: status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/event-insights/events
 * Returns the list of target events for the event selector dropdown.
 */
router.get('/events', async (req, res) => {
  try {
    const user = req.authUser;
    let whereClause = `WHERE e.id IN ('0542016a-b443-421e-9ae0-a4787697b945', 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89')`;
    let params = [];

    if (user && user.role !== 'super_admin' && user.eventId) {
      whereClause = `WHERE e.id = $1::text`;
      params = [user.eventId];
    }

    const sql = `
      SELECT 
        e.id, 
        e.name, 
        e.slug, 
        e.status, 
        e."eventType" AS event_type, 
        COUNT(ue.id)::int AS student_count
      FROM "Event" e
      LEFT JOIN "UserEvent" ue ON ue."eventId" = e.id
      ${whereClause}
      GROUP BY e.id, e.name, e.slug, e.status, e."eventType", e."createdAt"
      ORDER BY e."createdAt" DESC;
    `;
    const result = await query(sql, params);
    res.json(result.rows.map(formatEventRow));
  } catch (err) {
    handleDbError(res, err, 'fetch events');
  }
});

/**
 * GET /api/event-insights/comparison
 * Returns comparative metrics across events for benchmarking.
 * (Mounted before /:id routes so "comparison" is not parsed as an id)
 */
router.get('/comparison', async (req, res) => {
  try {
    const user = req.authUser;
    let whereClause = `WHERE e.id IN ('0542016a-b443-421e-9ae0-a4787697b945', 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89')`;
    let params = [];

    if (user && user.role !== 'super_admin' && user.eventId) {
      whereClause = `WHERE e.id = $1::text`;
      params = [user.eventId];
    }

    const sql = `
      SELECT 
        e.id,
        e.name,
        e.slug,
        COUNT(DISTINCT ue."userId")::int AS total_students,
        COUNT(DISTINCT u.grade)::int AS grades_covered,
        COUNT(DISTINCT SPLIT_PART(u.username, '-', 1))::int AS sections_covered,
        e."defaultAccessMins" AS duration_mins,
        COALESCE(MAX(s.name), 'Regional Cohort') AS institution
      FROM "Event" e
      JOIN "UserEvent" ue ON ue."eventId" = e.id
      JOIN "User" u ON u.id = ue."userId"
      LEFT JOIN "School" s ON s.id = u."schoolId"
      ${whereClause}
      GROUP BY e.id, e.name, e.slug, e."defaultAccessMins"
      ORDER BY total_students ASC;
    `;
    const result = await query(sql, params);
    res.json(result.rows.map(formatEventRow));
  } catch (err) {
    handleDbError(res, err, 'fetch event comparison');
  }
});

/**
 * GET /api/event-insights/:id/overview
 * Returns summary KPI cards and event metadata for the selected event.
 */
router.get('/:id/overview', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        e.id,
        e.name,
        e.slug,
        e.status,
        e."eventType" AS event_type,
        e."defaultAccessMins" AS default_access_mins,
        e."shareToken" AS share_token,
        'https://codevyuh.com/event/' || e.slug AS registration_link,
        e.description,
        e."createdAt" AS created_at,
        e."updatedAt" AS updated_at,
        COUNT(DISTINCT ue."userId")::int AS total_participants,
        COALESCE(MAX(s.name), 'Madurai Tech Cup Inter-School Cohort') AS institution_name,
        COALESCE(MAX(s.id), 'N/A') AS institution_id
      FROM "Event" e
      LEFT JOIN "UserEvent" ue ON ue."eventId" = e.id
      LEFT JOIN "User" u ON u.id = ue."userId"
      LEFT JOIN "School" s ON s.id = u."schoolId"
      WHERE e.id = $1::text
      GROUP BY e.id, e.name, e.slug, e.status, e."eventType", e."defaultAccessMins", 
               e."shareToken", e.description, e."createdAt", e."updatedAt";
    `;
    const result = await query(sql, [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(formatEventRow(result.rows[0]));
  } catch (err) {
    handleDbError(res, err, 'fetch event overview');
  }
});

/**
 * GET /api/event-insights/:id/participants
 * Provides paginated and searchable participant roster for the selected event.
 */
router.get('/:id/participants', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.q ? req.query.q.trim() : null;

    let countSql = `
      SELECT COUNT(*)::int AS total
      FROM "UserEvent" ue
      JOIN "User" u ON u.id = ue."userId"
      WHERE ue."eventId" = $1::text
    `;
    let countParams = [id];

    let dataSql = `
      SELECT 
        u.id,
        u.name,
        u.username,
        u.email,
        u.grade,
        u.role,
        u."createdAt" AS registered_at,
        COALESCE(s.name, 'Independent Participant') AS school_name,
        CASE 
          WHEN u.grade = '9' THEN UPPER(SPLIT_PART(u.username, '-', 1))
          ELSE 'Grade ' || COALESCE(u.grade, 'Unknown')
        END AS section_or_grade
      FROM "UserEvent" ue
      JOIN "User" u ON u.id = ue."userId"
      LEFT JOIN "School" s ON s.id = u."schoolId"
      WHERE ue."eventId" = $1::text
    `;
    let dataParams = [id];

    if (search) {
      countSql += ` AND (u.name ILIKE $2 OR u.username ILIKE $2)`;
      countParams.push(`%${search}%`);

      dataSql += ` AND (u.name ILIKE $2 OR u.username ILIKE $2)`;
      dataParams.push(`%${search}%`);
      dataSql += ` ORDER BY u."createdAt" ASC, u.username ASC LIMIT $3 OFFSET $4`;
      dataParams.push(limit, offset);
    } else {
      dataSql += ` ORDER BY u."createdAt" ASC, u.username ASC LIMIT $2 OFFSET $3`;
      dataParams.push(limit, offset);
    }

    const [countResult, dataResult] = await Promise.all([
      query(countSql, countParams),
      query(dataSql, dataParams)
    ]);

    const total = countResult.rows[0]?.total || 0;

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      participants: dataResult.rows
    });
  } catch (err) {
    handleDbError(res, err, 'fetch participants');
  }
});

/**
 * GET /api/event-insights/:id/grades
 * Provides grade/section distribution data for bar and doughnut charts.
 */
router.get('/:id/grades', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        CASE 
          WHEN u.grade = '9' THEN UPPER(SPLIT_PART(u.username, '-', 1))
          ELSE 'Grade ' || COALESCE(u.grade, 'Unknown')
        END AS label,
        COUNT(*)::int AS count
      FROM "UserEvent" ue
      JOIN "User" u ON u.id = ue."userId"
      WHERE ue."eventId" = $1::text
      GROUP BY label
      ORDER BY label ASC;
    `;
    const result = await query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    handleDbError(res, err, 'fetch grades breakdown');
  }
});

/**
 * GET /api/event-insights/:id/registration-trend
 * Provides registration timeline for cadence charts.
 */
router.get('/:id/registration-trend', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        DATE_TRUNC('hour', u."createdAt") AS time_bucket,
        COUNT(*)::int AS count
      FROM "UserEvent" ue
      JOIN "User" u ON u.id = ue."userId"
      WHERE ue."eventId" = $1::text
      GROUP BY time_bucket
      ORDER BY time_bucket ASC;
    `;
    const result = await query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    handleDbError(res, err, 'fetch registration trend');
  }
});

/**
 * GET /api/event-insights/:id/performance
 * Safely reports performance status without fabricating missing submission data.
 */
router.get('/:id/performance', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const subCount = await query(
      'SELECT COUNT(*)::int AS count FROM "Submission" WHERE "eventId" = $1',
      [id]
    );

    if (subCount.rows[0].count === 0) {
      return res.json({
        available: false,
        message: 'Performance data awaiting contest submissions',
        metrics: null
      });
    }

    res.json({
      available: true,
      submissionsCount: subCount.rows[0].count
    });
  } catch (err) {
    handleDbError(res, err, 'check performance data');
  }
});

module.exports = router;
