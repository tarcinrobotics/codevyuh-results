/**
 * admin-overview.js — Page controller for Event Insights Dashboard
 * Handles event selection, KPI animation, Chart.js visualizations,
 * participant pagination & search, and theme switching.
 */

import {
  fetchEventList,
  fetchEventOverview,
  fetchEventGrades,
  fetchEventTrend,
  fetchEventComparison,
  fetchEventParticipants,
} from './api.js';

import {
  buildGradeBarChart,
  buildCohortDoughnutChart,
  buildRegistrationTimelineChart,
  buildEventComparisonChart,
  registerChart,
} from './charts.js';

// ── State ─────────────────────────────────────────────────────────────────
let currentEventId = null;
let eventsCache = [];
let gradesCache = [];
let trendCache = [];
let comparisonCache = [];
let currentPage = 1;
const pageSize = 50;
let searchQuery = '';
let searchDebounceTimer = null;
let isRefreshing = false;

let autoRetryCount = 0;
const MAX_AUTO_RETRIES = 2;

// ── Boot ──────────────────────────────────────────────────────────────────
async function initDashboard() {
  clearErrorState();

  try {
    eventsCache = await fetchEventList();
    autoRetryCount = 0;
    populateEventDropdown(eventsCache);

    if (eventsCache.length > 0) {
      // Check URL search params for ?event=UUID, otherwise pick first event
      const urlParams = new URLSearchParams(window.location.search);
      const requestedId = urlParams.get('event');
      const matched = eventsCache.find(e => e.id === requestedId);
      currentEventId = matched ? matched.id : eventsCache[0].id;

      const selectEl = document.getElementById('filter-event');
      if (selectEl) selectEl.value = currentEventId;

      await loadAllPanels(currentEventId);
    } else {
      showErrorState('No competition events found in database.');
    }
  } catch (err) {
    console.error('Failed to initialize Event Insights:', err);
    showErrorState(err.message || 'Database unavailable');

    // Auto-retry once or twice after a short pause if DB was still starting up
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
      currentEventId = e.target.value;
      currentPage = 1;
      searchQuery = '';
      const searchInput = document.getElementById('roster-search-input');
      if (searchInput) searchInput.value = '';

      // Update URL without full reload
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('event', currentEventId);
      window.history.pushState({}, '', newUrl);

      await loadAllPanels(currentEventId);
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

  // Search input with debounce
  const searchInput = document.getElementById('roster-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(async () => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        await loadParticipants(currentEventId);
      }, 300);
    });
  }

  // Pagination Prev / Next
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (btnPrev) {
    btnPrev.addEventListener('click', async () => {
      if (currentPage > 1) {
        currentPage--;
        await loadParticipants(currentEventId);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      currentPage++;
      await loadParticipants(currentEventId);
    });
  }

  // Re-render charts on theme toggle so fonts and grid borders stay synchronized
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        reRenderCharts();
      }, 100);
    });
  });
}

// ── Populate Event Dropdown ───────────────────────────────────────────────
function populateEventDropdown(events) {
  const selectEl = document.getElementById('filter-event');
  if (!selectEl) return;

  selectEl.innerHTML = events.map(e => `
    <option value="${esc(e.id)}">
      ${esc(e.name)} (${e.student_count} students)
    </option>
  `).join('');
}

// ── Load All Dashboard Panels ─────────────────────────────────────────────
async function loadAllPanels(eventId) {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    // Show loading skeleton states on KPI cards
    setKpiLoading(true);

    const [overview, grades, trend, comparison] = await Promise.all([
      fetchEventOverview(eventId),
      fetchEventGrades(eventId),
      fetchEventTrend(eventId),
      fetchEventComparison(),
    ]);

    gradesCache = grades;
    trendCache = trend;
    comparisonCache = comparison;

    // Render Event Hero & KPIs
    renderHeroAndKpis(overview, grades);

    // Render 4 Charts
    renderCharts(grades, trend, comparison);

    // Render Participants Table
    await loadParticipants(eventId);

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

// ── Render Event Hero & KPI Cards ─────────────────────────────────────────
function renderHeroAndKpis(overview, grades) {
  // Hero metadata
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

  // 1: Registered Participants
  animateValue('kpi-total-participants', overview.total_participants, 0);

  // 2: Grade / Section Coverage
  const gradeCoverageEl = document.getElementById('kpi-grade-coverage');
  const gradeSubEl = document.getElementById('kpi-grade-sub');
  if (gradeCoverageEl) {
    if (grades.some(g => g.label.startsWith('KLN9'))) {
      gradeCoverageEl.textContent = 'Grade 9 (3 Sections)';
      if (gradeSubEl) gradeSubEl.textContent = 'Sections 9A, 9B, 9C';
    } else {
      const gradeCount = grades.length;
      gradeCoverageEl.textContent = `${gradeCount} Grades (3–8)`;
      if (gradeSubEl) gradeSubEl.textContent = `${gradeCount} academic levels`;
    }
  }

  // 3: Event Status
  const statusEl = document.getElementById('kpi-event-status');
  if (statusEl) {
    statusEl.innerHTML = `<span style="color:#10b981;font-weight:800;letter-spacing:0.02em">● ${esc(overview.status || 'OPEN')}</span>`;
  }

  // 4: Allocated Duration
  const durationEl = document.getElementById('kpi-allocated-duration');
  if (durationEl) {
    durationEl.textContent = `${overview.default_access_mins || 60} Mins`;
  }

  // Update status bar text
  const statusText = document.getElementById('filter-status-text');
  if (statusText) {
    statusText.textContent = `Displaying ${overview.total_participants} participants for ${overview.name}`;
  }
}

// ── Render Charts ─────────────────────────────────────────────────────────
function renderCharts(grades, trend, comparison) {
  try {
    // Chart A: Participants by Grade/Section — Bar
    const chartA = buildGradeBarChart('chart-grade-bar-canvas', grades);
    if (chartA) registerChart('gradeBar', chartA);

    // Chart B: Cohort Distribution — Doughnut
    const chartB = buildCohortDoughnutChart('chart-cohort-doughnut-canvas', grades);
    if (chartB) registerChart('cohortDoughnut', chartB);

    // Chart C: Registration Timeline — Line
    const chartC = buildRegistrationTimelineChart('chart-registration-timeline-canvas', trend);
    if (chartC) registerChart('regTimeline', chartC);

    // Chart D: KLN vs Mock Exam comparison — Grouped Bar
    const chartD = buildEventComparisonChart('chart-event-comparison-canvas', comparison);
    if (chartD) registerChart('eventComparison', chartD);
  } catch (err) {
    console.warn('[Charts] Non-fatal chart rendering notice:', err.message || err);
  }
}

function reRenderCharts() {
  if (gradesCache.length) {
    renderCharts(gradesCache, trendCache, comparisonCache);
  }
}

// ── Load & Render Participants ────────────────────────────────────────────
async function loadParticipants(eventId) {
  const tbody = document.getElementById('participants-tbody');
  const countBadge = document.getElementById('roster-count-badge');
  const pageInfo = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Loading participants…</td></tr>`;
  }

  try {
    const data = await fetchEventParticipants(eventId, {
      page: currentPage,
      limit: pageSize,
      q: searchQuery,
    });

    if (countBadge) countBadge.textContent = data.total;

    // Pagination calculations
    const startIdx = data.total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, data.total);

    if (pageInfo) {
      pageInfo.textContent = `Showing ${startIdx}–${endIdx} of ${data.total}`;
    }

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= data.totalPages;

    if (!tbody) return;

    if (!data.participants || data.participants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No participants found matching "${esc(searchQuery)}"</td></tr>`;
      return;
    }

    tbody.innerHTML = data.participants.map((p, idx) => {
      const rowNum = startIdx + idx;
      const registeredStr = p.registered_at
        ? new Date(p.registered_at).toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—';

      return `
        <tr>
          <td><span class="rank-badge">${rowNum}</span></td>
          <td style="font-weight:600;color:var(--text-primary)">${esc(p.name || 'Student Participant')}</td>
          <td><code style="font-size:0.78rem;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px">${esc(p.username)}</code></td>
          <td><span class="zone-count-pill">${esc(p.section_or_grade || 'Grade ' + (p.grade || '—'))}</span></td>
          <td style="color:var(--text-muted);font-size:0.78rem">${esc(registeredStr)}</td>
          <td style="font-size:0.8rem;color:var(--text-secondary)">${esc(p.school_name || 'Independent Participant')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444">Error loading roster: ${esc(err.message)}</td></tr>`;
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────
function setKpiLoading(isLoading) {
  const ids = ['kpi-total-participants', 'kpi-grade-coverage', 'kpi-event-status', 'kpi-allocated-duration'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isLoading) {
      el.classList.add('skeleton', 'value-loading');
    } else {
      el.classList.remove('skeleton', 'value-loading');
    }
  });
}

function animateValue(id, target, decimals = 0, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('skeleton', 'value-loading');

  const start = 0;
  const numTarget = parseFloat(target) || 0;
  const duration = 600;
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

function clearErrorState() {
  const existingBanner = document.getElementById('db-error-banner');
  if (existingBanner) existingBanner.remove();

  const statusText = document.getElementById('filter-status-text');
  if (statusText && (statusText.textContent.startsWith('Offline:') || statusText.textContent.startsWith('Error:'))) {
    statusText.textContent = 'Live database metrics';
  }

  // Clear any persistent skeleton loading classes
  const kpiIds = [
    'kpi-total-participants',
    'kpi-grades-covered',
    'kpi-event-status',
    'kpi-duration',
    'kpi-institution-name',
  ];
  kpiIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('skeleton', 'value-loading');
  });
}

function showErrorState(msg) {
  // If the error is a chart/canvas lifecycle issue or generic UI issue, do NOT display a database offline banner!
  if (!msg || typeof msg !== 'string' || msg.includes('Canvas is already in use') || msg.includes('Chart with ID') || msg.includes('must be destroyed before')) {
    console.warn('[UI] Suppressed client-side canvas/chart warning from error banner:', msg);
    return;
  }

  // Update status text
  const statusText = document.getElementById('filter-status-text');
  if (statusText) statusText.textContent = `Offline: ${msg}`;

  // Update dropdown so it stops showing "Loading target events…"
  const selectEl = document.getElementById('filter-event');
  if (selectEl && (!selectEl.value || selectEl.options.length <= 1)) {
    selectEl.innerHTML = `<option value="">Database offline — click Retry</option>`;
  }

  // Remove skeleton state from KPI cards and show fallback dash
  const kpiIds = [
    'kpi-total-participants',
    'kpi-grades-covered',
    'kpi-event-status',
    'kpi-duration',
    'kpi-institution-name',
  ];
  kpiIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('skeleton', 'value-loading');
      if (el.textContent === '' || el.textContent === '—' || el.textContent.includes('...')) {
        el.textContent = '—';
      }
    }
  });

  // Render retryable banner if not already present
  if (!document.getElementById('db-error-banner')) {
    const banner = document.createElement('div');
    banner.id = 'db-error-banner';
    banner.className = 'db-error-banner';
    banner.innerHTML = `
      <div class="db-error-content">
        <svg class="db-error-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div class="db-error-text">
          <strong>Database Offline or Reconnecting:</strong>
          <span>${esc(msg)}</span>
        </div>
      </div>
      <button id="btn-db-retry" class="btn-db-retry" type="button">
        <svg class="icon-retry" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        Retry Connection
      </button>
    `;

    const mainContainer = document.querySelector('.content-area') || document.querySelector('main') || document.querySelector('.filterbar');
    if (mainContainer) {
      if (mainContainer.classList.contains('filterbar')) {
        mainContainer.parentNode.insertBefore(banner, mainContainer.nextSibling);
      } else {
        mainContainer.insertBefore(banner, mainContainer.firstChild);
      }
    }

    const retryBtn = document.getElementById('btn-db-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        retryBtn.textContent = 'Reconnecting...';
        retryBtn.disabled = true;
        initDashboard();
      });
    }
  }
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
