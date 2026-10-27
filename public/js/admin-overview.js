/**
 * admin-overview.js — Unified Page Controller for Event Insights & Score Analytics
 * Provides first-class score-based analytics, performance tiers, deduction breakdown,
 * dynamic leaderboard/podium handling, cohort progression, and paginated roster.
 */

import {
  fetchEventList,
  fetchEventOverview,
  fetchEventActivityKpis,
  fetchEventGradeEngagement,
  fetchEventScoreAnalytics,
  fetchEventLeaderboard,
  fetchEventStudentActivity,
} from './api.js';

import {
  buildGradeEngagementChart,
  buildActivityFunnelChart,
  buildScoreDistributionChart,
  buildGradeScoreChart,
  registerChart,
} from './charts.js';

// ── State ─────────────────────────────────────────────────────────────────
const DOLPHIN_EVENT_ID = 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89';
const KLN_EVENT_ID = '0542016a-b443-421e-9ae0-a4787697b945';

let currentEventId = null;
let eventsCache = [];
let currentOverview = null;
let currentScoreData = null;
let currentKpis = null;
let currentGradeEngagement = null;
let currentLeaderboard = null;

// Roster state
let rosterCurrentPage = 1;
const rosterPageSize = 50;
let rosterSearchQuery = '';
let rosterGradeFilter = 'all';
let rosterStatusFilter = 'all';
let rosterDebounceTimer = null;

let isRefreshing = false;
let autoRetryCount = 0;
const MAX_AUTO_RETRIES = 2;

// ── Helper: HTML Escape ───────────────────────────────────────────────────
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Helper: Value Animator ────────────────────────────────────────────────
function animateValue(id, target, decimals = 0, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton', 'value-loading');

  const start = 0;
  const numTarget = parseFloat(target) || 0;
  const duration = 500;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (numTarget - start) * ease;
    el.textContent = current.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = numTarget.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + suffix;
    }
  }

  requestAnimationFrame(update);
}

// ── Helper: KPI Loading States ────────────────────────────────────────────
function setKpiLoading(isLoading) {
  const kpiIds = [
    'kpi-enrolled-count',
    'kpi-active-count',
    'kpi-attempts-count',
    'kpi-locks-count',
    'kpi-duration-val',
    'kpi-score-avg',
    'kpi-score-max',
    'kpi-score-pipeline',
    'kpi-score-deductions',
  ];

  kpiIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isLoading) {
      el.classList.add('skeleton', 'value-loading');
      el.innerHTML = '&nbsp;';
    } else {
      el.classList.remove('skeleton', 'value-loading');
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────
async function initDashboard() {
  clearErrorState();

  try {
    eventsCache = await fetchEventList();
    autoRetryCount = 0;

    if (eventsCache.length > 0) {
      // Check URL search params for ?event=UUID, URL pathname, or scoped user event
      const urlParams = new URLSearchParams(window.location.search);
      let requestedId = urlParams.get('event');
      if (!requestedId) {
        if (window.location.pathname.includes('/dolphin')) {
          requestedId = DOLPHIN_EVENT_ID;
        } else if (window.location.pathname.includes('/kln')) {
          requestedId = KLN_EVENT_ID;
        } else if (window.currentAuthUser && window.currentAuthUser.eventId) {
          requestedId = window.currentAuthUser.eventId;
        }
      }

      const matched = eventsCache.find(e => e.id === requestedId);
      currentEventId = matched ? matched.id : eventsCache[0].id;

      populateActiveEventHeader(eventsCache);

      const selectEl = document.getElementById('filter-event');
      if (selectEl) selectEl.value = currentEventId;

      await loadAllPanels(currentEventId);
    } else {
      showErrorState('No competition events found in database.');
    }
  } catch (err) {
    console.error('Failed to initialize Event Insights:', err);
    showErrorState(err.message || 'Database unavailable');

    if (autoRetryCount < MAX_AUTO_RETRIES) {
      autoRetryCount++;
      const statusText = document.getElementById('filter-status-text');
      if (statusText) statusText.textContent = `Connecting to database (auto-retry ${autoRetryCount}/${MAX_AUTO_RETRIES} in 3s)...`;
      setTimeout(() => {
        initDashboard();
      }, 3000);
    }
  }
}

(function boot() {
  setupEventListeners();
  initDashboard();
})();

// ── Setup DOM Event Listeners ─────────────────────────────────────────────
function setupEventListeners() {
  // Dropdown change
  const selectEl = document.getElementById('filter-event');
  if (selectEl) {
    selectEl.addEventListener('change', async (e) => {
      const newId = e.target.value;
      if (newId && newId !== currentEventId) {
        currentEventId = newId;
        rosterCurrentPage = 1;
        rosterSearchQuery = '';
        rosterGradeFilter = 'all';
        rosterStatusFilter = 'all';

        const searchInput = document.getElementById('roster-search-input');
        if (searchInput) searchInput.value = '';

        const gradeSelect = document.getElementById('roster-grade-filter');
        if (gradeSelect) gradeSelect.value = 'all';

        const statusSelect = document.getElementById('roster-status-filter');
        if (statusSelect) statusSelect.value = 'all';

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('event', currentEventId);
        window.history.pushState({}, '', newUrl);

        await loadAllPanels(currentEventId);
      }
    });
  }

  // Refresh button
  const refreshBtn = document.getElementById('btn-refresh-event');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (currentEventId) {
        refreshBtn.classList.add('loading');
        await loadAllPanels(currentEventId);
        refreshBtn.classList.remove('loading');
      }
    });
  }

  // Roster Search input with debounce
  const searchInput = document.getElementById('roster-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(rosterDebounceTimer);
      rosterDebounceTimer = setTimeout(async () => {
        rosterSearchQuery = e.target.value.trim();
        rosterCurrentPage = 1;
        await loadRosterTable(currentEventId);
      }, 300);
    });
  }

  // Roster Grade filter
  const gradeFilter = document.getElementById('roster-grade-filter');
  if (gradeFilter) {
    gradeFilter.addEventListener('change', async (e) => {
      rosterGradeFilter = e.target.value;
      rosterCurrentPage = 1;
      await loadRosterTable(currentEventId);
    });
  }

  // Roster Status filter
  const statusFilter = document.getElementById('roster-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', async (e) => {
      rosterStatusFilter = e.target.value;
      rosterCurrentPage = 1;
      await loadRosterTable(currentEventId);
    });
  }

  // Pagination buttons
  const btnPrev = document.getElementById('btn-roster-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', async () => {
      if (rosterCurrentPage > 1) {
        rosterCurrentPage--;
        await loadRosterTable(currentEventId);
      }
    });
  }

  const btnNext = document.getElementById('btn-roster-next');
  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      rosterCurrentPage++;
      await loadRosterTable(currentEventId);
    });
  }

  // CSV Export Buttons
  document.getElementById('btn-export-roster-hero')?.addEventListener('click', exportRosterCsv);
  document.getElementById('btn-export-roster-table')?.addEventListener('click', exportRosterCsv);

  // Re-render charts on theme toggle
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        reRenderCharts();
      }, 100);
    });
  });
}

// ── Populate Active Event Header / Dropdown ──────────────────────────────
function populateActiveEventHeader(events) {
  const selectEl = document.getElementById('filter-event');
  const displayEl = document.getElementById('active-event-display');
  if (!events || events.length === 0) return;

  const user = window.currentAuthUser;
  const isSuperAdmin = user && user.role === 'super_admin';

  if (selectEl) {
    selectEl.innerHTML = events.map(e => `
      <option value="${esc(e.id)}">
        ${esc(e.display_name || e.name)} (${e.student_count} students)
      </option>
    `).join('');
    if (currentEventId) selectEl.value = currentEventId;
  }

  const activeEvt = events.find(e => e.id === currentEventId) || events[0];

  if (!isSuperAdmin || events.length <= 1) {
    if (selectEl) {
      selectEl.style.display = 'none';
      selectEl.disabled = true;
    }
    if (displayEl) {
      displayEl.style.display = 'inline-flex';
      if (activeEvt) {
        displayEl.textContent = `${activeEvt.display_name || activeEvt.name} (${activeEvt.student_count} students)`;
      }
    }
  } else {
    if (selectEl) {
      selectEl.style.display = '';
      selectEl.disabled = false;
      selectEl.style.opacity = '1';
      selectEl.style.cursor = 'pointer';
    }
    if (displayEl) {
      displayEl.style.display = 'none';
    }
  }
}

// ── Load All Dashboard Panels ─────────────────────────────────────────────
async function loadAllPanels(eventId) {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    setKpiLoading(true);

    const displayEl = document.getElementById('active-event-display');
    if (displayEl && eventsCache.length > 0) {
      const cur = eventsCache.find(e => e.id === eventId) || eventsCache[0];
      if (cur) {
        displayEl.textContent = `${cur.display_name || cur.name} (${cur.student_count} students)`;
      }
    }

    const [overview, scoreData, kpis, gradeEngagement, leaderboard] = await Promise.all([
      fetchEventOverview(eventId),
      fetchEventScoreAnalytics(eventId),
      fetchEventActivityKpis(eventId),
      fetchEventGradeEngagement(eventId),
      fetchEventLeaderboard(eventId),
    ]);

    currentOverview = overview;
    currentScoreData = scoreData;
    currentKpis = kpis;
    currentGradeEngagement = gradeEngagement;
    currentLeaderboard = leaderboard;

    // 1. Render Hero Metadata
    renderHeroMetadata(overview);

    // 2. Render Overview KPIs and Score Analytics
    renderKpisAndScoreAnalytics(overview, scoreData, kpis);

    // 3. Render Podium and Leaderboard
    renderLeaderboardAndPodium(leaderboard);

    // 4. Render Visualizations
    renderCharts(scoreData, gradeEngagement, kpis);

    // 5. Populate Grade Dropdown
    populateGradeFilter(gradeEngagement, scoreData.gradeScores);

    // 6. Load Student Roster Table
    await loadRosterTable(eventId);

    const statusText = document.getElementById('filter-status-text');
    if (statusText) {
      const scoreNote = scoreData.hasOfficialScores ? 'Official Exam Scores Verified' : 'Awaiting Exam Score Ingestion';
      statusText.textContent = `Displaying ${kpis.enrolled} students · ${scoreNote}`;
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Error loading event panels:', err);
    if (err && err.message && !err.message.includes('Canvas is already in use') && !err.message.includes('Chart with ID')) {
      showErrorState(err.message);
    }
  } finally {
    setKpiLoading(false);
    isRefreshing = false;
  }
}

// ── Render Shared Event Hero Metadata ─────────────────────────────────────
function renderHeroMetadata(overview) {
  const instNameEl = document.getElementById('event-institution-name');
  const heroTitleEl = document.getElementById('event-hero-title');
  const heroDescEl = document.getElementById('event-hero-desc');
  const eventIdText = document.getElementById('event-id-text');
  const eventLinkText = document.getElementById('event-link-text');
  const btnEventLink = document.getElementById('btn-event-link');
  const quickType = document.getElementById('event-quick-type');
  const quickStatus = document.getElementById('event-quick-status');

  if (instNameEl) instNameEl.textContent = overview.institution_name || 'Institution Cohort';
  if (heroTitleEl) heroTitleEl.textContent = overview.name || 'Event Insights';
  if (heroDescEl) heroDescEl.textContent = overview.description || 'Verified competition and assessment event.';
  if (eventIdText) eventIdText.textContent = (overview.id || '').slice(0, 8) + '…';
  if (eventLinkText) eventLinkText.textContent = overview.slug ? `codevyuh.com/event/${overview.slug}` : '—';
  if (btnEventLink && overview.registration_link) {
    btnEventLink.href = overview.registration_link;
  }
  if (quickType) quickType.innerHTML = `<i data-lucide="tag" class="icon-sm"></i> ${esc(overview.event_type || 'GENERAL')}`;
  if (quickStatus) {
    quickStatus.innerHTML = `<span class="pulse-dot"></span> ${esc(overview.status || 'OPEN')}`;
  }
}

// ── Render KPIs & Score Analytics ─────────────────────────────────────────
function renderKpisAndScoreAnalytics(overview, scoreData, kpis) {
  // 1. Overview KPIs
  animateValue('kpi-enrolled-count', kpis.enrolled || 0, 0);
  animateValue('kpi-active-count', kpis.activeStudents || 0, 0);
  animateValue('kpi-attempts-count', kpis.totalAttempts || 0, 0);
  animateValue('kpi-locks-count', kpis.lockedRecords || 0, 0);

  const durationEl = document.getElementById('kpi-duration-val');
  if (durationEl) {
    durationEl.classList.remove('skeleton', 'value-loading');
    durationEl.textContent = `${overview.default_access_mins || 60} mins`;
  }

  const activeSub = document.getElementById('kpi-active-sub');
  if (activeSub) activeSub.textContent = `${kpis.activeRate}% activity rate`;

  const attemptsSub = document.getElementById('kpi-attempts-sub');
  if (attemptsSub) attemptsSub.textContent = `Across ${scoreData.diagnosticActivity?.totalChallengeRows || 0} challenge rows`;

  const locksSub = document.getElementById('kpi-locks-sub');
  if (locksSub) locksSub.textContent = `Affecting ${kpis.studentsWithLocks || 0} students`;

  // 2. Score Section Header Pill
  const pillEl = document.getElementById('score-pipeline-pill');
  if (pillEl) {
    if (scoreData.hasOfficialScores) {
      pillEl.style.background = 'rgba(16,185,129,0.15)';
      pillEl.style.color = '#10b981';
      pillEl.style.borderColor = 'rgba(16,185,129,0.3)';
      pillEl.innerHTML = `<i data-lucide="check-circle" class="icon-sm"></i> Official Submissions Ingested`;
    } else {
      pillEl.style.background = 'rgba(245,158,11,0.15)';
      pillEl.style.color = '#f59e0b';
      pillEl.style.borderColor = 'rgba(245,158,11,0.3)';
      pillEl.innerHTML = `<i data-lucide="clock" class="icon-sm"></i> Awaiting Ingestion Sync`;
    }
  }

  // 3. 4 Score KPI Cards
  const avgScore = scoreData.metrics?.averageScore || 0;
  animateValue('kpi-score-avg', avgScore, 0, ' pts');

  const avgSub = document.getElementById('kpi-score-avg-sub');
  if (avgSub) {
    avgSub.textContent = scoreData.hasOfficialScores
      ? `${scoreData.metrics.scoredStudents} students evaluated · Cumulative points`
      : 'Standby (0 scored)';
  }

  const maxScore = scoreData.metrics?.highestScore || 0;
  animateValue('kpi-score-max', maxScore, 0, ' pts');

  const maxSub = document.getElementById('kpi-score-max-sub');
  if (maxSub) {
    maxSub.textContent = `${scoreData.metrics?.scoringCoverageRate || 0}% scoring coverage`;
  }

  const pipelineEl = document.getElementById('kpi-score-pipeline');
  const pipelineSub = document.getElementById('kpi-score-pipeline-sub');
  if (pipelineEl) {
    pipelineEl.classList.remove('skeleton', 'value-loading');
    if (scoreData.hasOfficialScores) {
      pipelineEl.innerHTML = `<span style="color:#10b981;font-weight:700">Ingested</span>`;
      if (pipelineSub) pipelineSub.textContent = `${scoreData.metrics.scoredStudents} verified scores`;
    } else {
      pipelineEl.innerHTML = `<span style="color:#f59e0b;font-weight:700">Standby</span>`;
      if (pipelineSub) pipelineSub.textContent = 'Awaiting platform sync';
    }
  }

  const deductionsEl = document.getElementById('kpi-score-deductions');
  const deductionsSub = document.getElementById('kpi-score-deductions-sub');
  const deductionsPts = scoreData.metrics?.wrongAttemptDeductions || 0;
  if (deductionsEl) {
    deductionsEl.classList.remove('skeleton', 'value-loading');
    deductionsEl.innerHTML = deductionsPts > 0
      ? `<span style="color:#ef4444;font-weight:700">-${deductionsPts} pts</span>`
      : `<span style="color:#10b981;font-weight:700">0 pts</span>`;
  }
  if (deductionsSub) {
    deductionsSub.textContent = `Retry deductions (-5 pts) · Survival: ${scoreData.metrics?.solvabilitySurvivalRate || 100}%`;
  }
}

// ── Render Visualizations ─────────────────────────────────────────────────
function renderCharts(scoreData, gradeEngagement, kpis) {
  try {
    // 1. Score Performance Tiers Chart
    if (scoreData && scoreData.distribution) {
      const chartTiers = buildScoreDistributionChart('chart-score-tiers-canvas', scoreData.distribution);
      if (chartTiers) registerChart('scoreTiers', chartTiers);
    }

    // 2. Grade-Level Score Comparison Chart
    if (scoreData && scoreData.gradeScores) {
      const chartGradeScores = buildGradeScoreChart('chart-grade-scores-canvas', scoreData.gradeScores);
      if (chartGradeScores) registerChart('gradeScores', chartGradeScores);
    }

    // 3. Cohort Distribution by Grade Chart
    if (gradeEngagement) {
      const chartGradeCohort = buildGradeEngagementChart('chart-grade-cohort-canvas', gradeEngagement);
      if (chartGradeCohort) registerChart('gradeCohort', chartGradeCohort);
    }

    // 4. Activity Progression Funnel Chart
    if (kpis) {
      const chartFunnel = buildActivityFunnelChart('chart-funnel-canvas', kpis);
      if (chartFunnel) registerChart('activityFunnel', chartFunnel);
    }
  } catch (err) {
    console.warn('[Charts Notice]', err.message || err);
  }
}

// ── Re-render Charts (Theme Switcher) ─────────────────────────────────────
function reRenderCharts() {
  if (currentScoreData && currentGradeEngagement && currentKpis) {
    renderCharts(currentScoreData, currentGradeEngagement, currentKpis);
  }
}

// ── Render Leaderboard & Podium ───────────────────────────────────────────
function renderLeaderboardAndPodium(leaderboard) {
  const modeBadge = document.getElementById('leaderboard-mode-badge');
  const standbyBanner = document.getElementById('leaderboard-standby-banner');
  const podiumGrid = document.getElementById('contest-podium-grid');
  const tableWrap = document.getElementById('leaderboard-table-wrap');
  const tbody = document.getElementById('leaderboard-tbody');
  const thMetric = document.getElementById('th-leaderboard-metric');
  const diagWrap = document.getElementById('diagnostic-standings-wrap');
  const diagTbody = document.getElementById('diagnostic-tbody');

  const isScoreBased = leaderboard && leaderboard.isScoreBased;

  if (isScoreBased && leaderboard.top3 && leaderboard.top3.length > 0) {
    // ── Official Score Leaderboard Active ──
    if (modeBadge) {
      modeBadge.textContent = 'Official Score Rankings';
      modeBadge.style.color = '#10b981';
      modeBadge.style.borderColor = 'rgba(16,185,129,0.3)';
    }
    if (standbyBanner) standbyBanner.style.display = 'none';
    if (podiumGrid) podiumGrid.style.display = 'grid';
    if (tableWrap) tableWrap.style.display = '';
    if (thMetric) thMetric.textContent = 'Official Exam Score';
    if (diagWrap) diagWrap.style.display = 'none';

    // Populate Tournament Podium
    const [r1, r2, r3] = leaderboard.top3;
    if (r1) {
      setElText('podium-gold-name', r1.name || r1.username);
      setElText('podium-gold-username', `@${r1.username}`);
      setElText('podium-gold-grade', `Grade ${r1.grade || '—'}`);
      setElText('podium-gold-score', `${Number(r1.score || 0).toLocaleString()} pts`);
      setElText('podium-gold-solved', `${r1.challenges_solved || 0} Challenges Solved`);
    }
    if (r2) {
      setElText('podium-silver-name', r2.name || r2.username);
      setElText('podium-silver-username', `@${r2.username}`);
      setElText('podium-silver-grade', `Grade ${r2.grade || '—'}`);
      setElText('podium-silver-score', `${Number(r2.score || 0).toLocaleString()} pts`);
      setElText('podium-silver-solved', `${r2.challenges_solved || 0} Challenges Solved`);
    }
    if (r3) {
      setElText('podium-bronze-name', r3.name || r3.username);
      setElText('podium-bronze-username', `@${r3.username}`);
      setElText('podium-bronze-grade', `Grade ${r3.grade || '—'}`);
      setElText('podium-bronze-score', `${Number(r3.score || 0).toLocaleString()} pts`);
      setElText('podium-bronze-solved', `${r3.challenges_solved || 0} Challenges Solved`);
    }

    if (window.lucide) {
      try { lucide.createIcons(); } catch (_) {}
    }

    // Populate Top 10 Table
    if (tbody && leaderboard.top10) {
      tbody.innerHTML = leaderboard.top10.map(st => `
        <tr>
          <td><span class="rank-badge rank-${st.rank}">${st.rank}</span></td>
          <td style="font-weight:600;color:var(--text-primary)">${esc(st.name || st.username)}</td>
          <td><code style="font-size:0.78rem;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">${esc(st.username)}</code></td>
          <td><span class="zone-count-pill">Grade ${esc(st.grade)}</span></td>
          <td style="color:var(--text-secondary);font-size:0.8rem">${st.challenges_solved || 0} solved</td>
          <td style="font-weight:700;color:#10b981;font-variant-numeric:tabular-nums">${Number(st.score || 0).toLocaleString()} pts</td>
        </tr>
      `).join('');
    }
  } else {
    // ── Score Ingestion Pending: Standby Mode ──
    if (modeBadge) {
      modeBadge.textContent = 'Evaluation Standby';
      modeBadge.style.color = '#f59e0b';
      modeBadge.style.borderColor = 'rgba(245,158,11,0.3)';
    }
    if (standbyBanner) standbyBanner.style.display = 'flex';
    if (podiumGrid) podiumGrid.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'none';

    // Show Diagnostic Standings if attempt volume exists
    const diagList = leaderboard?.diagnosticStandings || [];
    if (diagWrap && diagList.length > 0) {
      diagWrap.style.display = 'block';
      if (diagTbody) {
        diagTbody.innerHTML = diagList.map((st, i) => `
          <tr>
            <td><span class="rank-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;border-color:rgba(245,158,11,0.3)">${st.rank || i + 1}</span></td>
            <td style="font-weight:600;color:var(--text-primary)">${esc(st.name || st.username)}</td>
            <td><code style="font-size:0.78rem;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">${esc(st.username)}</code></td>
            <td><span class="zone-count-pill">Grade ${esc(st.grade)}</span></td>
            <td style="font-weight:700;color:#38bdf8">${st.total_attempts} Practice Attempts</td>
          </tr>
        `).join('');
      }
    } else if (diagWrap) {
      diagWrap.style.display = 'none';
    }
  }
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Populate Grade Filter ─────────────────────────────────────────────────
function populateGradeFilter(gradeEngagement, gradeScores) {
  const filterEl = document.getElementById('roster-grade-filter');
  if (!filterEl) return;

  const currentVal = filterEl.value;
  const grades = new Set();

  if (Array.isArray(gradeEngagement)) {
    gradeEngagement.forEach(g => { if (g.grade) grades.add(String(g.grade)); });
  }
  if (Array.isArray(gradeScores)) {
    gradeScores.forEach(g => {
      if (g.grade_label) {
        const cleaned = g.grade_label.replace(/^Grade\s+/i, '');
        grades.add(cleaned);
      }
    });
  }

  const sortedGrades = Array.from(grades).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  filterEl.innerHTML = `<option value="all">All Grades (${sortedGrades.length})</option>` +
    sortedGrades.map(g => `<option value="${esc(g)}">Grade ${esc(g)}</option>`).join('');

  if (sortedGrades.includes(currentVal)) {
    filterEl.value = currentVal;
  } else {
    filterEl.value = 'all';
  }
}

// ── Load Student Roster Table ─────────────────────────────────────────────
async function loadRosterTable(eventId) {
  const tbody = document.getElementById('roster-tbody');
  const countBadge = document.getElementById('roster-count-badge');
  const pageInfo = document.getElementById('roster-pagination-info');
  const btnPrev = document.getElementById('btn-roster-prev');
  const btnNext = document.getElementById('btn-roster-next');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Loading student records…</td></tr>`;
  }

  try {
    const data = await fetchEventStudentActivity(eventId, {
      page: rosterCurrentPage,
      limit: rosterPageSize,
      grade: rosterGradeFilter,
      status: rosterStatusFilter,
      q: rosterSearchQuery,
    });

    if (countBadge) countBadge.textContent = data.total;

    const startIdx = data.total === 0 ? 0 : (rosterCurrentPage - 1) * rosterPageSize + 1;
    const endIdx = Math.min(rosterCurrentPage * rosterPageSize, data.total);
    if (pageInfo) pageInfo.textContent = `Showing ${startIdx}–${endIdx} of ${data.total}`;

    if (btnPrev) btnPrev.disabled = rosterCurrentPage <= 1;
    if (btnNext) btnNext.disabled = rosterCurrentPage >= (data.totalPages || 1);

    if (tbody) {
      if (!data.students || data.students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--text-muted)">No students match the current filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.students.map((st, i) => {
        const rowNum = startIdx + i;
        const statusBadge = getStatusBadge(st.activity_status);
        const scoreVal = parseInt(st.exam_score, 10) || 0;
        const scoreDisplay = scoreVal > 0
          ? `<span style="font-weight:700;color:#10b981">${scoreVal.toLocaleString()} pts</span>`
          : `<span style="color:var(--text-muted);font-size:0.8rem">Pending</span>`;

        return `
          <tr>
            <td style="color:var(--text-muted);font-size:0.8rem">${rowNum}</td>
            <td style="font-weight:600;color:var(--text-primary)">${esc(st.name || st.username)}</td>
            <td><code style="font-size:0.78rem;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">${esc(st.username)}</code></td>
            <td><span class="zone-count-pill">Grade ${esc(st.grade)}</span></td>
            <td>${st.challenges_opened}</td>
            <td>${st.attempts}</td>
            <td>${st.locked_count > 0 ? `<span style="color:#ef4444;font-weight:700">${st.locked_count}</span>` : '0'}</td>
            <td>${scoreDisplay}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load roster:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:#ef4444">Error loading roster: ${esc(err.message)}</td></tr>`;
    }
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'locked':
      return `<span class="status-pill status-locked"><span class="status-dot"></span> Locked (${status})</span>`;
    case 'attempted':
      return `<span class="status-pill status-attempted"><span class="status-dot"></span> Attempted</span>`;
    case 'opened_only':
      return `<span class="status-pill status-active"><span class="status-dot"></span> Active</span>`;
    default:
      return `<span class="status-pill status-no-activity"><span class="status-dot"></span> No Activity</span>`;
  }
}

// ── Error State Management ────────────────────────────────────────────────
function showErrorState(msg) {
  const statusText = document.getElementById('filter-status-text');
  if (statusText) {
    statusText.textContent = `Error: ${msg}`;
    statusText.style.color = '#ef4444';
  }
}

function clearErrorState() {
  const statusText = document.getElementById('filter-status-text');
  if (statusText) {
    statusText.textContent = 'Live database metrics';
    statusText.style.color = '';
  }
}


// ── Export Cohort Roster to CSV ──────────────────────────────────────────
async function exportRosterCsv() {
  if (!currentEventId) return;
  const btnHero = document.getElementById('btn-export-roster-hero');
  const btnTable = document.getElementById('btn-export-roster-table');
  if (btnHero) { btnHero.disabled = true; btnHero.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm"></i> Exporting…'; }
  if (btnTable) { btnTable.disabled = true; btnTable.innerHTML = '<i data-lucide="refresh-cw" class="icon-sm"></i> Exporting…'; }
  if (window.lucide) lucide.createIcons();

  try {
    const data = await fetchEventStudentActivity(currentEventId, {
      page: 1,
      limit: 2000,
      grade: rosterGradeFilter,
      status: rosterStatusFilter,
      q: rosterSearchQuery,
    });

    const students = data.students || [];
    if (!students.length) {
      alert('No student records found to export.');
      return;
    }

    const headers = ['Rank', 'Student Name', 'Username', 'Grade', 'Challenges Opened', 'Attempts', 'Locked Records', 'Exam Score (pts)', 'Activity Status'];
    const csvLines = [headers.join(',')];

    students.forEach((st, idx) => {
      const name = (st.name || st.username || '').replace(/"/g, '""');
      const row = [
        idx + 1,
        `"${name}"`,
        `"${st.username || ''}"`,
        `"${st.grade || ''}"`,
        st.challenges_opened || 0,
        st.attempts || 0,
        st.locked_count || 0,
        parseInt(st.exam_score, 10) || 0,
        `"${st.activity_status || ''}"`
      ];
      csvLines.push(row.join(','));
    });

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = (currentEventOverview?.slug || 'codevyuh_roster').replace(/[^a-z0-9_-]/gi, '_');
    link.href = url;
    link.download = `codevyuh_roster_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('CSV export error:', err);
    alert('Failed to export CSV: ' + err.message);
  } finally {
    if (btnHero) { btnHero.disabled = false; btnHero.innerHTML = '<i data-lucide="download" class="icon-sm"></i> <span>Export Roster CSV</span>'; }
    if (btnTable) { btnTable.disabled = false; btnTable.innerHTML = '<i data-lucide="download" class="icon-sm"></i> <span>Export CSV</span>'; }
    if (window.lucide) lucide.createIcons();
  }
}
