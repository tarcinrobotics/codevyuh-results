/**
 * scripts/seed-tournament-scores.js
 * Generates realistic multi-challenge competition submissions for Dolphin PRELIMS and KLN PRELIMS.
 * Creates submissions across the 306-challenge problem catalog, producing scores
 * ranging from 1,000 to 11,000+ points with authentic competitive programming distributions.
 */
const { pool, query } = require('../db');

async function seedTournamentScores() {
  console.log('=== SEEDING MULTI-CHALLENGE TOURNAMENT SUBMISSIONS (10,000+ PTS SCALE) ===');

  const dolphinEventId = 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89';
  const klnEventId = '0542016a-b443-421e-9ae0-a4787697b945';

  // 1. Gather all challenge IDs from Problem table and interactive challenges
  const problemRows = await query(`SELECT id, title, category, "maxScore" FROM "Problem"`);
  const problems = problemRows.rows;

  const interactiveChallenges = [
    'logic-pattern_match-001', 'logic-pattern_match-002', 'logic-pattern_match-003', 'logic-pattern_match-004', 'logic-pattern_match-005',
    'logic-pattern_match-006', 'logic-pattern_match-007', 'logic-pattern_match-008', 'logic-pattern_match-009', 'logic-pattern_match-010',
    'logic-boolean_circuit-001', 'logic-boolean_circuit-002', 'logic-boolean_circuit-003', 'logic-boolean_circuit-004', 'logic-boolean_circuit-005',
    'logic-boolean_circuit-006', 'logic-boolean_circuit-007', 'logic-boolean_circuit-008', 'logic-boolean_circuit-009', 'logic-boolean_circuit-010',
    'logic-memory_grid-001', 'logic-memory_grid-002', 'logic-memory_grid-003', 'logic-memory_grid-004', 'logic-memory_grid-005',
    'logic-state_machine-001', 'logic-state_machine-002', 'logic-state_machine-003', 'logic-state_machine-004', 'logic-state_machine-005',
    'logic-robot_path-001', 'logic-robot_path-002', 'logic-robot_path-003', 'logic-robot_path-004', 'logic-robot_path-005',
    'logic-graph_traversal-001', 'logic-graph_traversal-002', 'logic-graph_traversal-003',
    'debug-flow_designer-001', 'debug-flow_designer-002', 'debug-flow_designer-003', 'debug-flow_designer-004', 'debug-flow_designer-005',
    'debug-flow_designer_pro-001', 'debug-flow_designer_pro-002', 'debug-flow_designer_pro-003',
    'python-syntax_fix-001', 'python-syntax_fix-002', 'python-syntax_fix-003', 'python-syntax_fix-004', 'python-syntax_fix-005',
    'systems-architecture-001', 'systems-architecture-002', 'systems-architecture-003',
  ];

  const challengePool = [
    ...interactiveChallenges.map(cid => ({
      id: cid,
      track: cid.split('-')[0],
      isInteractive: true,
    })),
    ...problems.map(p => ({
      id: p.id,
      track: p.category.toLowerCase().includes('python') ? 'python' : (p.category.toLowerCase().includes('debug') ? 'debug' : 'logic'),
      isInteractive: false,
    }))
  ];
  console.log(`Master challenge catalog: ${challengePool.length} distinct challenges.`);

  // Clean existing submissions for these events
  await query(`DELETE FROM "Submission" WHERE "eventId" IN ($1, $2);`, [dolphinEventId, klnEventId]);
  await query(`
    DELETE FROM "ChallengeStatus" 
    WHERE "userId" IN (
      SELECT "userId" FROM "UserEvent" WHERE "eventId" IN ($1, $2)
    ) AND "challengeId" NOT IN ('logic-boolean_circuit-003', 'logic-pattern_match-003', 'logic-pattern_match-001', 'logic-memory_grid-001', 'logic-boolean_circuit-002');
  `, [dolphinEventId, klnEventId]);

  console.log('Cleaned previous placeholder rows.');

  // 2. DOLPHIN PRELIMS: 555 students
  const dolphinStudents = (await query(`
    SELECT u.id, u.username, u.name, u.grade
    FROM "UserEvent" ue
    JOIN "User" u ON u.id = ue."userId"
    WHERE ue."eventId" = $1
    ORDER BY u."createdAt" ASC, u.username ASC;
  `, [dolphinEventId])).rows;

  console.log(`Processing ${dolphinStudents.length} Dolphin students...`);

  const dolphinTopTiers = {
    tier1: ['mtc-3a-1042-27', 'mtc-4c-706-19', 'mtc-8b-177-33', 'mtc-5b-1653-29', 'mtc-8c-876-78'],
    tier2: ['mtc-5b-1400-5', 'mtc-6b-1664-73', 'mtc-8a-1702-3', 'mtc-8a-38-14', 'mtc-5a-562-24', 'mtc-7b-2-53', 'mtc-3a-1603-22', 'mtc-8c-1441-81', 'mtc-5b-1107-7', 'mtc-3b-1059-18'],
  };

  let subValues = [];
  let csValues = [];
  const baseDate = new Date('2026-08-13T06:00:00.000Z');

  for (let idx = 0; idx < dolphinStudents.length; idx++) {
    const st = dolphinStudents[idx];
    
    let challengeCount = 0;
    let baseAccuracy = 0.92;

    if (dolphinTopTiers.tier1.includes(st.username)) {
      const bonus = dolphinTopTiers.tier1.indexOf(st.username);
      challengeCount = 118 - (bonus * 3);
      baseAccuracy = 0.98;
    } else if (dolphinTopTiers.tier2.includes(st.username)) {
      challengeCount = 70 + (idx % 16);
      baseAccuracy = 0.95;
    } else if (idx < 50) {
      challengeCount = 45 + (idx % 20);
      baseAccuracy = 0.93;
    } else if (idx < 180) {
      challengeCount = 28 + (idx % 17);
      baseAccuracy = 0.90;
    } else if (idx < 350) {
      challengeCount = 16 + (idx % 12);
      baseAccuracy = 0.86;
    } else if (idx < 500) {
      challengeCount = 7 + (idx % 9);
      baseAccuracy = 0.80;
    } else {
      challengeCount = 1 + (idx % 5);
      baseAccuracy = 0.75;
    }

    const assignedChallenges = challengePool.slice(0, challengeCount);

    for (let cIdx = 0; cIdx < assignedChallenges.length; cIdx++) {
      const ch = assignedChallenges[cIdx];
      const isPerfect = (cIdx % 5 !== 0);
      const score = isPerfect ? 100 : (70 + (cIdx % 25));
      const status = score >= 90 ? 'ACCEPTED' : 'PARTIAL';
      const timeTakenMs = (45 + (cIdx * 3) + (idx % 20)) * 1000;
      const subTime = new Date(baseDate.getTime() + (idx * 60000) + (cIdx * 90000));
      const attempts = isPerfect ? 1 : (1 + (cIdx % 3));

      subValues.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `sub-dol-${idx}-${cIdx}-${Date.now().toString(36)}`,
        userId: st.id,
        challengeId: ch.id,
        eventId: dolphinEventId,
        score,
        status,
        timeTakenMs,
        attempts,
        createdAt: subTime,
      });

      csValues.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `cs-dol-${idx}-${cIdx}-${Date.now().toString(36)}`,
        userId: st.id,
        challengeId: ch.id,
        status: status === 'ACCEPTED' ? 'COMPLETED' : 'ATTEMPTED',
        attempts,
        isLocked: false,
        createdAt: subTime,
        updatedAt: subTime,
      });
    }
  }

  // 3. KLN PRELIMS: 107 Grade 9 students
  const klnStudents = (await query(`
    SELECT u.id, u.username, u.name, u.grade
    FROM "UserEvent" ue
    JOIN "User" u ON u.id = ue."userId"
    WHERE ue."eventId" = $1
    ORDER BY u."createdAt" ASC, u.username ASC;
  `, [klnEventId])).rows;

  console.log(`Processing ${klnStudents.length} KLN Grade 9 students...`);

  const klnBaseDate = new Date('2026-08-20T06:00:00.000Z');

  for (let idx = 0; idx < klnStudents.length; idx++) {
    const st = klnStudents[idx];
    let challengeCount = 0;

    if (idx === 0) {
      challengeCount = 110;
    } else if (idx === 1) {
      challengeCount = 106;
    } else if (idx === 2) {
      challengeCount = 102;
    } else if (idx < 10) {
      challengeCount = 75 + (idx % 20);
    } else if (idx < 30) {
      challengeCount = 45 + (idx % 18);
    } else if (idx < 65) {
      challengeCount = 25 + (idx % 15);
    } else if (idx < 95) {
      challengeCount = 12 + (idx % 10);
    } else {
      challengeCount = 3 + (idx % 6);
    }

    const assignedChallenges = challengePool.slice(0, challengeCount);

    for (let cIdx = 0; cIdx < assignedChallenges.length; cIdx++) {
      const ch = assignedChallenges[cIdx];
      const isPerfect = (cIdx % 4 !== 0);
      const score = isPerfect ? 100 : (75 + (cIdx % 20));
      const status = score >= 90 ? 'ACCEPTED' : 'PARTIAL';
      const timeTakenMs = (40 + (cIdx * 2) + (idx % 15)) * 1000;
      const subTime = new Date(klnBaseDate.getTime() + (idx * 50000) + (cIdx * 80000));
      const attempts = isPerfect ? 1 : (1 + (cIdx % 2));

      subValues.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `sub-kln-${idx}-${cIdx}-${Date.now().toString(36)}`,
        userId: st.id,
        challengeId: ch.id,
        eventId: klnEventId,
        score,
        status,
        timeTakenMs,
        attempts,
        createdAt: subTime,
      });

      csValues.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `cs-kln-${idx}-${cIdx}-${Date.now().toString(36)}`,
        userId: st.id,
        challengeId: ch.id,
        status: status === 'ACCEPTED' ? 'COMPLETED' : 'ATTEMPTED',
        attempts,
        isLocked: false,
        createdAt: subTime,
        updatedAt: subTime,
      });
    }
  }

  console.log(`Total generated submissions: ${subValues.length}. Inserting in batches...`);

  // Batch insert into Submission table
  const BATCH_SIZE = 1000;
  for (let i = 0; i < subValues.length; i += BATCH_SIZE) {
    const batch = subValues.slice(i, i + BATCH_SIZE);
    const valueClauses = [];
    const params = [];
    let pIdx = 1;

    for (const r of batch) {
      valueClauses.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7}, $${pIdx+8})`);
      params.push(r.id, r.userId, r.challengeId, r.eventId, r.score, r.status, r.timeTakenMs, r.attempts, r.createdAt);
      pIdx += 9;
    }

    const insertSql = `
      INSERT INTO "Submission" (id, "userId", "challengeId", "eventId", score, status, "timeTakenMs", attempts, "createdAt")
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT (id) DO NOTHING;
    `;
    await query(insertSql, params);
  }

  console.log(`✅ Successfully seeded ${subValues.length} submissions.`);
}

if (require.main === module) {
  seedTournamentScores()
    .then(() => {
      console.log('Tournament seeding complete.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedTournamentScores };
