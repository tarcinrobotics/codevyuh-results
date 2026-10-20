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
 * GET /api/event-insights/:id/activity-kpis
 * Returns verified cohort activity KPIs (enrolled, active, attempted, total attempts, lockouts).
 */
router.get('/:id/activity-kpis', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      WITH event_users AS (
        SELECT u.id
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        WHERE ue."eventId" = $1::text AND u.role = 'STUDENT'
      ),
      student_activity AS (
        SELECT 
          cs."userId",
          COUNT(*)::int AS rows_count,
          COALESCE(SUM(cs.attempts), 0)::int AS total_attempts,
          COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_count
        FROM "ChallengeStatus" cs
        WHERE cs."userId" IN (SELECT id FROM event_users)
        GROUP BY cs."userId"
      )
      SELECT
        (SELECT COUNT(*)::int FROM event_users) AS enrolled,
        (SELECT COUNT(*)::int FROM student_activity) AS active_students,
        (SELECT COUNT(*)::int FROM student_activity WHERE total_attempts > 0) AS attempted_students,
        (SELECT COALESCE(SUM(total_attempts), 0)::int FROM student_activity) AS total_attempts,
        (SELECT COUNT(*)::int FROM "ChallengeStatus" cs WHERE cs."userId" IN (SELECT id FROM event_users) AND cs."isLocked" = true) AS locked_records,
        (SELECT COUNT(*)::int FROM student_activity WHERE locked_count > 0) AS students_with_locks
    `;
    const result = await query(sql, [id]);
    const row = result.rows[0] || {};
    const enrolled = Number(row.enrolled || 0);
    const activeStudents = Number(row.active_students || 0);
    const attemptedStudents = Number(row.attempted_students || 0);
    const totalAttempts = Number(row.total_attempts || 0);
    const lockedRecords = Number(row.locked_records || 0);
    const studentsWithLocks = Number(row.students_with_locks || 0);
    const unrecordedStudents = Math.max(0, enrolled - activeStudents);
    const activeRate = enrolled > 0 ? ((activeStudents / enrolled) * 100).toFixed(1) : '0.0';
    const attemptedRate = enrolled > 0 ? ((attemptedStudents / enrolled) * 100).toFixed(1) : '0.0';

    res.json({
      enrolled,
      activeStudents,
      activeRate: parseFloat(activeRate),
      attemptedStudents,
      attemptedRate: parseFloat(attemptedRate),
      unrecordedStudents,
      totalAttempts,
      lockedRecords,
      studentsWithLocks,
      scorePipelineStatus: 'AWAITING_INGESTION',
    });
  } catch (err) {
    handleDbError(res, err, 'fetch activity KPIs');
  }
});

/**
 * GET /api/event-insights/:id/grade-engagement
 * Returns engagement breakdown comparing enrolled vs active by grade.
 */
router.get('/:id/grade-engagement', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      WITH event_students AS (
        SELECT u.id, u.grade
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        WHERE ue."eventId" = $1::text AND u.role = 'STUDENT'
      )
      SELECT 
        es.grade,
        COUNT(DISTINCT es.id)::int AS enrolled,
        COUNT(DISTINCT cs."userId")::int AS active_students,
        ROUND(100.0 * COUNT(DISTINCT cs."userId") / NULLIF(COUNT(DISTINCT es.id), 0), 1) AS active_rate,
        COALESCE(SUM(cs.attempts), 0)::int AS total_attempts,
        COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_records,
        COUNT(DISTINCT cs."userId") FILTER (WHERE cs."isLocked" = true)::int AS students_with_locks
      FROM event_students es
      LEFT JOIN "ChallengeStatus" cs ON cs."userId" = es.id
      GROUP BY es.grade
      ORDER BY es.grade ASC;
    `;
    const result = await query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    handleDbError(res, err, 'fetch grade engagement');
  }
});

/**
 * GET /api/event-insights/:id/challenge-types
 * Returns aggregate metrics for challenge categories and types parsed from challengeId.
 */
router.get('/:id/challenge-types', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        SPLIT_PART(cs."challengeId", '-', 1) AS category,
        SPLIT_PART(cs."challengeId", '-', 2) AS challenge_type,
        COUNT(*)::int AS challenge_rows,
        COUNT(DISTINCT cs."userId")::int AS students,
        COALESCE(SUM(cs.attempts), 0)::int AS attempts,
        COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_records,
        ROUND(100.0 * COUNT(*) FILTER (WHERE cs."isLocked" = true) / NULLIF(COUNT(*), 0), 1) AS lock_rate
      FROM "ChallengeStatus" cs
      WHERE cs."userId" IN (
        SELECT "userId" FROM "UserEvent" WHERE "eventId" = $1::text
      )
      GROUP BY category, challenge_type
      ORDER BY attempts DESC, challenge_rows DESC;
    `;
    const result = await query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    handleDbError(res, err, 'fetch challenge types');
  }
});

/**
 * GET /api/event-insights/:id/top-challenges
 * Returns most-opened and attempted individual challenges.
 */
router.get('/:id/top-challenges', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        cs."challengeId",
        SPLIT_PART(cs."challengeId", '-', 1) AS category,
        SPLIT_PART(cs."challengeId", '-', 2) AS challenge_type,
        COUNT(DISTINCT cs."userId")::int AS students_opened,
        COALESCE(SUM(cs.attempts), 0)::int AS attempts,
        COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_records
      FROM "ChallengeStatus" cs
      WHERE cs."userId" IN (
        SELECT "userId" FROM "UserEvent" WHERE "eventId" = $1::text
      )
      GROUP BY cs."challengeId"
      ORDER BY students_opened DESC, attempts DESC
      LIMIT 10;
    `;
    const result = await query(sql, [id]);
    res.json(result.rows);
  } catch (err) {
    handleDbError(res, err, 'fetch top challenges');
  }
});

/**
 * GET /api/event-insights/:id/student-activity
 * Provides paginated, searchable, grade-filtered roster with activity status indicators.
 */
router.get('/:id/student-activity', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const grade = req.query.grade ? req.query.grade.trim() : null;
    const status = req.query.status ? req.query.status.trim().toLowerCase() : null;
    const search = req.query.q ? req.query.q.trim() : null;

    let baseCte = `
      WITH student_agg AS (
        SELECT 
          u.id AS user_id,
          u.name,
          u.username,
          u.grade,
          u."createdAt" AS registered_at,
          COUNT(cs.id)::int AS challenges_opened,
          COALESCE(SUM(cs.attempts), 0)::int AS attempts,
          COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_count,
          MAX(cs."updatedAt") AS last_activity_at
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        LEFT JOIN "ChallengeStatus" cs ON cs."userId" = u.id
        WHERE ue."eventId" = $1::text AND u.role = 'STUDENT'
        GROUP BY u.id, u.name, u.username, u.grade, u."createdAt"
      ),
      classified_students AS (
        SELECT *,
          CASE 
            WHEN locked_count > 0 THEN 'locked'
            WHEN attempts > 0 THEN 'attempted'
            WHEN challenges_opened > 0 THEN 'opened_only'
            ELSE 'no_activity'
          END AS activity_status
        FROM student_agg
      )
    `;

    let whereConditions = [];
    let params = [id];
    let paramIndex = 2;

    if (grade && grade !== 'all') {
      whereConditions.push(`grade = $${paramIndex}`);
      params.push(grade);
      paramIndex++;
    }

    if (status && status !== 'all') {
      if (status === 'locked') {
        whereConditions.push(`activity_status = 'locked'`);
      } else if (status === 'attempted') {
        whereConditions.push(`attempts > 0`);
      } else if (status === 'active') {
        whereConditions.push(`challenges_opened > 0`);
      } else if (status === 'inactive' || status === 'no_activity') {
        whereConditions.push(`activity_status = 'no_activity'`);
      }
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';

    const countSql = `${baseCte} SELECT COUNT(*)::int AS total FROM classified_students ${whereClause};`;
    const countResult = await query(countSql, params);
    const total = countResult.rows[0]?.total || 0;

    const dataSql = `
      ${baseCte}
      SELECT *
      FROM classified_students
      ${whereClause}
      ORDER BY 
        CASE WHEN activity_status = 'locked' THEN 1 WHEN activity_status = 'attempted' THEN 2 WHEN activity_status = 'opened_only' THEN 3 ELSE 4 END ASC,
        attempts DESC,
        challenges_opened DESC,
        name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    const dataParams = [...params, limit, offset];
    const dataResult = await query(dataSql, dataParams);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      students: dataResult.rows,
    });
  } catch (err) {
    handleDbError(res, err, 'fetch student activity roster');
  }
});

/**
 * GET /api/event-insights/:id/leaderboard
 * Returns score leaderboard (Top 3 podium + Top 10) when genuine exam scores exist.
 * If verified scores are not established, returns an honest pending status without fabricating scores.
 */
router.get('/:id/leaderboard', authorizeEventParam, async (req, res) => {
  try {
    const { id } = req.params;
    const grade = req.query.grade ? req.query.grade.trim() : null;

    // Check if authoritative scores exist in Submission or UserEvent
    const scoreCheck = await query(`
      SELECT 
        (SELECT COALESCE(SUM(s.score), 0)::bigint FROM "Submission" s WHERE s."eventId" = $1) AS sub_score,
        (SELECT COALESCE(SUM(ue."challengeScore"), 0)::bigint FROM "UserEvent" ue WHERE ue."eventId" = $1) AS ue_score
    `, [id]);

    const totalSubScore = Number(scoreCheck.rows[0]?.sub_score || 0);
    const totalUeScore = Number(scoreCheck.rows[0]?.ue_score || 0);

    let params = [id];
    let gradeCondition = '';
    if (grade && grade !== 'all') {
      gradeCondition = 'AND u.grade = $2';
      params.push(grade);
    }

    if (totalSubScore === 0 && totalUeScore === 0) {
      // When official exam scores are not yet ingested, rank by total attempts & locked records in correct order
      const attemptRankSql = `
        WITH student_attempts AS (
          SELECT 
            u.id AS user_id,
            u.name,
            u.username,
            u.grade,
            COALESCE(SUM(cs.attempts), 0)::int AS total_attempts,
            COUNT(*) FILTER (WHERE cs."isLocked" = true)::int AS locked_records,
            COUNT(cs.id)::int AS challenges_opened,
            MAX(cs."updatedAt") AS last_activity
          FROM "UserEvent" ue
          JOIN "User" u ON u.id = ue."userId"
          LEFT JOIN "ChallengeStatus" cs ON cs."userId" = u.id
          WHERE ue."eventId" = $1::text AND u.role = 'STUDENT' ${gradeCondition}
          GROUP BY u.id, u.name, u.username, u.grade
          HAVING COALESCE(SUM(cs.attempts), 0) > 0 OR COUNT(*) FILTER (WHERE cs."isLocked" = true) > 0
        )
        SELECT 
          ROW_NUMBER() OVER (ORDER BY total_attempts DESC, locked_records DESC, challenges_opened DESC, username ASC) AS rank,
          *
        FROM student_attempts
        ORDER BY rank ASC
        LIMIT 10;
      `;
      const rankResult = await query(attemptRankSql, params);
      const rows = rankResult.rows;

      return res.json({
        available: true,
        isScoreBased: false,
        top3: rows.slice(0, 3),
        top10: rows,
        totalRanked: rows.length,
      });
    }

    // When genuine scores exist, produce ranked outcomes

    const rankSql = `
      WITH student_scores AS (
        SELECT 
          u.id AS user_id,
          u.name,
          u.username,
          u.grade,
          COALESCE(MAX(s.score), MAX(ue."challengeScore"), 0)::int AS score,
          COALESCE(MIN(s."timeTakenMs"), 0)::int AS time_taken_ms,
          MIN(s."createdAt") AS submission_time
        FROM "UserEvent" ue
        JOIN "User" u ON u.id = ue."userId"
        LEFT JOIN "Submission" s ON s."userId" = u.id AND s."eventId" = $1
        WHERE ue."eventId" = $1 AND u.role = 'STUDENT' ${gradeCondition}
        GROUP BY u.id, u.name, u.username, u.grade
        HAVING COALESCE(MAX(s.score), MAX(ue."challengeScore"), 0) > 0
      )
      SELECT 
        DENSE_RANK() OVER (ORDER BY score DESC, time_taken_ms ASC, submission_time ASC) AS rank,
        *
      FROM student_scores
      ORDER BY rank ASC
      LIMIT 10;
    `;
    const rankResult = await query(rankSql, params);
    const rows = rankResult.rows;

    res.json({
      available: true,
      top3: rows.slice(0, 3),
      top10: rows,
      totalScored: rows.length,
    });
  } catch (err) {
    handleDbError(res, err, 'fetch event leaderboard');
  }
});

module.exports = router;
