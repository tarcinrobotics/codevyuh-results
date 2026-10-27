/**
 * charts.js — Chart.js wrapper utilities
 * Creates and updates all chart instances on the page.
 */

// Chart.js palette mapped to CSS variables (resolved at runtime)
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#ec4899',
];

const SCORE_BASE  = '#10b981';
const SCORE_WRONG = '#ef4444';
const SCORE_TIME  = '#f59e0b';
const SCORE_HINT  = '#8b5cf6';
const INDIA_TIMEZONE = 'Asia/Kolkata';

// Shared Chart.js defaults
Chart.defaults.color          = '#8fa3bf';
Chart.defaults.borderColor    = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family    = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size      = 11;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 16;
Chart.defaults.plugins.tooltip.backgroundColor = '#0f1e38';
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(56,189,248,0.3)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.tooltip.titleColor      = '#e8edf5';
Chart.defaults.plugins.tooltip.bodyColor       = '#8fa3bf';
Chart.defaults.plugins.tooltip.cornerRadius    = 8;

/**
 * Safely retrieves a canvas element and ensures any existing Chart instance on it is destroyed.
 * Prevents "Canvas is already in use" Chart.js runtime errors.
 */
export function getCleanCanvas(canvasId) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
    const existing = Chart.getChart(el);
    if (existing) {
      try {
        existing.destroy();
      } catch (_) {}
    }
  }
  return el;
}

// ── School-wise Performance — Grouped Bar ─────────────────────────────────
/**
 * @param {string} canvasId
 * @param {Array}  rows  [{zone, submissions, total_score, student_count}]
 * @returns Chart instance
 */
export function buildZonePerformanceChart(canvasId, rows) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  // Limit to top 20 schools for readability
  const data = rows.slice(0, 20);
  const labels = data.map(r => r.zone);

  const totalScores  = data.map(r => parseInt(r.total_score)   || 0);
  const submissions  = data.map(r => parseInt(r.submissions)   || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Score',
          data: totalScores,
          backgroundColor: totalScores.map(v => v >= 50000
            ? hexAlpha('#10b981', 0.85)
            : v >= 10000
            ? hexAlpha('#f59e0b', 0.85)
            : hexAlpha('#ef4444', 0.85)
          ),
          borderColor: totalScores.map(v => v >= 50000 ? '#10b981' : v >= 10000 ? '#f59e0b' : '#ef4444'),
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'yTotalScore',
          order: 1,
        },
        {
          label: 'Total Submissions',
          data: submissions,
          backgroundColor: hexAlpha('#3b82f6', 0.75),
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'ySubmissions',
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {},
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              // Show full school name in title
              const idx = items[0].dataIndex;
              return data[idx]?.zone || items[0].label;
            },
            label: (item) => {
              const idx = item.dataIndex;
              const zone = data[idx];
              if (item.datasetIndex === 0) {
                return [
                  `  🏆 Total Score : ${parseInt(zone.total_score || 0).toLocaleString('en-IN')}`,
                  `  👥 Students  : ${parseInt(zone.student_count || 0).toLocaleString('en-IN')}`,
                ];
              } else {
                return [
                  `  📝 Submissions: ${parseInt(zone.submissions || 0).toLocaleString('en-IN')}`,
                  `  🏆 Total Score: ${parseInt(zone.total_score || 0).toLocaleString('en-IN')}`,
                ];
              }
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 90,
            minRotation: 90,
            autoSkip: false,
            font: { size: 9 },
            color: '#8fa3bf',
          },
        },
        yTotalScore: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Total Score', color: '#10b981', font: { size: 10 } },
          ticks: { color: '#10b981', precision: 0 },
        },
        ySubmissions: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Submissions', color: '#3b82f6', font: { size: 10 } },
          ticks: { color: '#3b82f6', precision: 0 },
        },
      },
    },
  });
}



// ── Submission Timeline — Line chart ──────────────────────────────────────
/**
 * @param {string} canvasId
 * @param {Array}  rows   [{time_bucket, zone, submission_count}]
 * @returns Chart instance
 */
export function buildTimelineChart(canvasId, rows) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  // Pivot by zone
  const zones   = [...new Set(rows.map(r => r.zone))];
  const buckets = [...new Set(rows.map(r => r.time_bucket))].sort();
  const labels  = buckets.map(b => {
    const d = new Date(b);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: INDIA_TIMEZONE,
    });
  });

  const datasets = zones.slice(0, 8).map((zone, i) => {
    const data = buckets.map(bucket => {
      const found = rows.find(r => r.zone === zone && r.time_bucket === bucket);
      return found ? found.submission_count : 0;
    });
    return {
      label: zone,
      data,
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: hexAlpha(CHART_COLORS[i % CHART_COLORS.length], 0.15),
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: true,
    };
  });

  // If no zones (single zone filter), make one dataset
  if (datasets.length === 0) {
    const totals = buckets.map(bucket => {
      const found = rows.find(r => r.time_bucket === bucket);
      return found ? found.submission_count : 0;
    });
    datasets.push({
      label: 'Submissions',
      data: totals,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.15)',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.35,
      fill: true,
    });
  }

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { maxRotation: 35, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { precision: 0 },
          title: { display: true, text: 'Submissions', color: '#4d6580' },
        },
      },
    },
  });
}

// ── School Progress Bands — Stacked Bar ──────────────────────────────────
/**
 * @param {string} canvasId
 * @param {Array} rows [{zone, no_submission_count, emerging_count, progressing_count, advanced_count}]
 * @returns Chart instance
 */
export function buildProgressBandsChart(canvasId, rows) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const data = rows.slice(0, 12);
  const labels = data.map((r) => r.zone);
  const noSubmission = data.map((r) => parseInt(r.no_submission_count) || 0);
  const emerging = data.map((r) => parseInt(r.emerging_count) || 0);
  const progressing = data.map((r) => parseInt(r.progressing_count) || 0);
  const advanced = data.map((r) => parseInt(r.advanced_count) || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'No Submission',
          data: noSubmission,
          backgroundColor: hexAlpha('#64748b', 0.82),
          borderColor: '#64748b',
          borderWidth: 1.2,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Emerging',
          data: emerging,
          backgroundColor: hexAlpha('#f59e0b', 0.82),
          borderColor: '#f59e0b',
          borderWidth: 1.2,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Progressing',
          data: progressing,
          backgroundColor: hexAlpha('#3b82f6', 0.82),
          borderColor: '#3b82f6',
          borderWidth: 1.2,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Advanced',
          data: advanced,
          backgroundColor: hexAlpha('#10b981', 0.82),
          borderColor: '#10b981',
          borderWidth: 1.2,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, pointStyle: 'rectRounded' },
        },
        tooltip: {
          callbacks: {
            title: (items) => data[items[0].dataIndex]?.zone || items[0].label,
            footer: (items) => {
              const idx = items[0]?.dataIndex ?? 0;
              const total = noSubmission[idx] + emerging[idx] + progressing[idx] + advanced[idx];
              return ` Total students: ${total.toLocaleString('en-IN')}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            maxRotation: 90,
            minRotation: 90,
            autoSkip: false,
            font: { size: 9 },
            color: '#8fa3bf',
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Student Count', color: '#4d6580' },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

// ── Scoring Breakdown — Grouped & Stacked Bar chart ───────────────────────
/**
 * @param {string} canvasId
 * @param {Array}  rows  [{zone, total_score, total_wrong_deduction, total_time_deduction, total_hint_deduction}]
 * @returns Chart instance
 */
export function buildScoringChart(canvasId, rows) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const labels = rows.map(r => r.zone);

  const wrongDeductions = rows.map(r => Math.abs(parseFloat(r.total_wrong_deduction) || 0));
  const timeDeductions  = rows.map(r => Math.abs(parseFloat(r.total_time_deduction)  || 0));
  const hintDeductions  = rows.map(r => Math.abs(parseFloat(r.total_hint_deduction)  || 0));
  const baseContrib     = rows.map(r => Math.max(0, parseFloat(r.total_score) || 0));

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Score',
          data: baseContrib,
          backgroundColor: hexAlpha(SCORE_BASE, 0.8),
          borderColor: SCORE_BASE,
          borderWidth: 1,
          borderRadius: 4,
          stack: 'main',
          order: 1,
        },
        {
          label: 'Wrong Attempt Deduction',
          data: wrongDeductions,
          backgroundColor: hexAlpha(SCORE_WRONG, 0.75),
          borderColor: SCORE_WRONG,
          borderWidth: 1,
          borderRadius: 2,
          stack: 'deductions',
          order: 2,
        },
        {
          label: 'Time Deduction',
          data: timeDeductions,
          backgroundColor: hexAlpha(SCORE_TIME, 0.75),
          borderColor: SCORE_TIME,
          borderWidth: 1,
          borderRadius: 2,
          stack: 'deductions',
          order: 3,
        },
        {
          label: 'Hint Deduction',
          data: hintDeductions,
          backgroundColor: hexAlpha(SCORE_HINT, 0.75),
          borderColor: SCORE_HINT,
          borderWidth: 1,
          borderRadius: 2,
          stack: 'deductions',
          order: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: {},
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y;
              const prefix = ctx.datasetIndex === 0 ? '' : '-';
              return ` ${ctx.dataset.label}: ${prefix}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pts`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 90,
            minRotation: 90,
            autoSkip: false,
            font: { size: 9 },
            color: '#8fa3bf',
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'Points', color: '#4d6580' },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

// ── School Score Ranges — Bar chart showing schools by score bucket ───────
/**
 * @param {string} canvasId
 * @param {Array}  rows  [{zone, total_score, score_range}]
 * @returns Chart instance
 */
export function buildScoreRangeChart(canvasId, rows) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  // Correct order matching query CASE output
  const rangeOrder = [
    '0 – 5K', '5K – 20K', '20K – 50K',
    '50K – 100K', '100K – 250K', '250K – 500K', '500K+',
  ];

  // Count how many schools fall in each bucket
  const rangeCounts = {};
  rangeOrder.forEach(r => { rangeCounts[r] = 0; });

  rows.forEach(r => {
    const range = r.score_range;
    if (range in rangeCounts) rangeCounts[range]++;
    else rangeCounts[range] = (rangeCounts[range] || 0) + 1;
  });

  // Only show buckets that have at least one school
  const labels = rangeOrder.filter(r => rangeCounts[r] > 0);
  const data   = labels.map(l => rangeCounts[l]);

  const bucketColors = [
    '#ef4444', '#f59e0b', '#eab308',
    '#84cc16', '#10b981', '#06b6d4', '#3b82f6',
  ];
  const colorMap = {};
  rangeOrder.forEach((r, i) => { colorMap[r] = bucketColors[i % bucketColors.length]; });

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map(l => hexAlpha(colorMap[l], 0.82)),
        borderColor:     labels.map(l => colorMap[l]),
        borderWidth: 2,
        hoverOffset: 12,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'right',
          align: 'center',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            padding: 14,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            title: items => `Score Range: ${items[0].label}`,
            label: item => {
              const count = item.parsed;
              const total = data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
              return [
                `  🏫 Schools: ${count}`,
                `  📊 Share: ${pct}%`,
              ];
            },
          },
        },
      },
    },
    plugins: [{
      id: 'centerLabel',
      afterDraw(chart) {
        const { width, height, ctx: c } = chart;
        const total = data.reduce((a, b) => a + b, 0);
        c.save();
        c.font = `bold ${Math.round(height / 5.5)}px Inter, sans-serif`;
        c.fillStyle = '#e8edf5';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(total, width / 2, height / 2 - 6);
        c.font = `${Math.round(height / 11)}px Inter, sans-serif`;
        c.fillStyle = '#4d6580';
        c.fillText('schools total', width / 2, height / 2 + height * 0.12);
        c.restore();
      },
    }],
  });
}



// ── Participation Rate — Radial gauge (simple arc) ────────────────────────
/**
 * @param {string} canvasId
 * @param {number} rate  0–100
 * @returns Chart instance
 */
export function buildParticipationGauge(canvasId, rate) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const val = Math.min(100, Math.max(0, parseFloat(rate) || 0));

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [val, 100 - val],
        backgroundColor: ['#3b82f6', 'rgba(255,255,255,0.05)'],
        borderWidth: 0,
        circumference: 270,
        rotation: 225,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { width, height, ctx: c } = chart;
        c.save();
        c.font = `bold ${Math.round(height / 4.5)}px Inter, sans-serif`;
        c.fillStyle = '#e8edf5';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`${val.toFixed(1)}%`, width / 2, height / 2 + 10);
        c.font = `${Math.round(height / 8)}px Inter, sans-serif`;
        c.fillStyle = '#4d6580';
        c.fillText('participation', width / 2, height / 2 + height * 0.22);
        c.restore();
      },
    }],
  });
}

// ── Utility: hex + alpha ──────────────────────────────────────────────────
function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Chart instance registry (for updates/destroy) ─────────────────────────
const _registry = new Map();

export function registerChart(key, instance) {
  if (_registry.has(key)) {
    try {
      _registry.get(key).destroy();
    } catch (_) {}
  }
  _registry.set(key, instance);
}

export function destroyAll() {
  _registry.forEach(c => {
    try {
      c.destroy();
    } catch (_) {}
  });
  _registry.clear();
}

// ═════════════════════════════════════════════════════════════════════════════
// EVENT INSIGHTS CHART BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

const EVENT_PALETTE = [
  '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1'
];

/**
 * Chart A: Participants by Grade/Section — Bar
 * @param {string} canvasId
 * @param {Array}  gradeData  [{label: 'KLN9A', count: 34}, ...]
 */
export function buildGradeBarChart(canvasId, gradeData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const labels = gradeData.map(d => d.label);
  const counts = gradeData.map(d => parseInt(d.count, 10) || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  const backgroundColors = labels.map((_, i) => hexAlpha(EVENT_PALETTE[i % EVENT_PALETTE.length], 0.85));
  const borderColors     = labels.map((_, i) => EVENT_PALETTE[i % EVENT_PALETTE.length]);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Participants',
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 54,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const val = item.parsed.y;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${val} participants (${pct}% of cohort)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: '600' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Enrolled Participants',
            color: '#8fa3bf',
            font: { size: 11, weight: '500' },
          },
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

/**
 * Chart B: Cohort Distribution — Doughnut
 * @param {string} canvasId
 * @param {Array}  gradeData  [{label: 'KLN9A', count: 34}, ...]
 */
export function buildCohortDoughnutChart(canvasId, gradeData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const labels = gradeData.map(d => d.label);
  const counts = gradeData.map(d => parseInt(d.count, 10) || 0);
  const total = counts.reduce((a, b) => a + b, 0);

  const backgroundColors = labels.map((_, i) => hexAlpha(EVENT_PALETTE[i % EVENT_PALETTE.length], 0.9));
  const borderColors     = labels.map((_, i) => EVENT_PALETTE[i % EVENT_PALETTE.length]);

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const val = item.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
              return ` ${item.label}: ${val} (${pct}%)`;
            },
          },
        },
      },
    },
    plugins: [{
      id: 'centerTotal',
      afterDraw(chart) {
        const { width, height, ctx: c } = chart;
        c.save();
        const isDark = document.documentElement.dataset.theme !== 'light';
        c.font = `bold ${Math.max(16, Math.round(height / 10))}px Inter, sans-serif`;
        c.fillStyle = isDark ? '#e8edf5' : '#0f172a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(`${total}`, width / 2, height / 2 - 14);

        c.font = `${Math.max(10, Math.round(height / 18))}px Inter, sans-serif`;
        c.fillStyle = isDark ? '#8fa3bf' : '#64748b';
        c.fillText('Participants', width / 2, height / 2 + 8);
        c.restore();
      },
    }],
  });
}

/**
 * Chart C: Registration Timeline — Line
 * @param {string} canvasId
 * @param {Array}  trendData  [{time_bucket: '...', count: 107}, ...]
 */
export function buildRegistrationTimelineChart(canvasId, trendData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  // Format time bucket labels to human-readable format
  const labels = trendData.map(d => {
    try {
      const dt = new Date(d.time_bucket);
      return dt.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return String(d.time_bucket);
    }
  });

  const counts = trendData.map(d => parseInt(d.count, 10) || 0);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Registrations',
        data: counts,
        borderColor: '#38bdf8',
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(56,189,248,0.1)';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(56,189,248,0.3)');
          gradient.addColorStop(1, 'rgba(56,189,248,0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Time Window: ${items[0].label}`,
            label: (item) => ` ${item.parsed.y} students registered`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { maxRotation: 30, font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Enrolled Students',
            color: '#8fa3bf',
            font: { size: 11, weight: '500' },
          },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

/**
 * Chart D: KLN vs Mock Exam comparison — Grouped Bar
 * @param {string} canvasId
 * @param {Array}  compData  Array of event records
 */
export function buildEventComparisonChart(canvasId, compData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const kln = compData.find(e => e.name && e.name.includes('KLN')) || compData[0] || {};
  const mock = compData.find(e => e.name && e.name.includes('Mock')) || compData[1] || {};

  const metrics = [
    'Total Participants',
    'Grades Covered',
    'Class Sections',
    'Duration (Mins)',
  ];

  const klnVals = [
    parseInt(kln.total_students, 10) || 0,
    parseInt(kln.grades_covered, 10) || 0,
    parseInt(kln.sections_covered, 10) || 0,
    parseInt(kln.duration_mins, 10) || 0,
  ];

  const mockVals = [
    parseInt(mock.total_students, 10) || 0,
    parseInt(mock.grades_covered, 10) || 0,
    parseInt(mock.sections_covered, 10) || 0,
    parseInt(mock.duration_mins, 10) || 0,
  ];

  const datasets = [];
  const hasKln = compData.some(e => e.id === '0542016a-b443-421e-9ae0-a4787697b945' || (e.name && e.name.includes('KLN')));
  const hasDolphin = compData.some(e => e.id === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89' || (e.name && (e.name.includes('Dolphin') || e.name.includes('Mock'))));

  if (hasKln) {
    datasets.push({
      label: 'KLN PRELIMS',
      data: klnVals,
      backgroundColor: hexAlpha('#3b82f6', 0.85),
      borderColor: '#3b82f6',
      borderWidth: 1.5,
      borderRadius: 4,
      maxBarThickness: 36,
    });
  }

  if (hasDolphin) {
    datasets.push({
      label: 'Dolphin PRELIMS',
      data: mockVals,
      backgroundColor: hexAlpha('#06b6d4', 0.85),
      borderColor: '#06b6d4',
      borderWidth: 1.5,
      borderRadius: 4,
      maxBarThickness: 36,
    });
  }

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: metrics,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            padding: 12,
            usePointStyle: true,
            pointStyle: 'rectRounded',
          },
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: '600', size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// DOLPHIN PRELIMS SPECIFIC CHART BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Chart A: Grade-wise Engagement Comparison — Grouped Bar
 * @param {string} canvasId
 * @param {Array} gradeData [{grade: '3', enrolled: 103, active_students: 12, total_attempts: 11, ...}]
 */
export function buildGradeEngagementChart(canvasId, gradeData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const labels = gradeData.map(d => `Grade ${d.grade}`);
  const enrolled = gradeData.map(d => parseInt(d.enrolled, 10) || 0);
  const active = gradeData.map(d => parseInt(d.active_students, 10) || 0);
  const attempts = gradeData.map(d => parseInt(d.total_attempts, 10) || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Enrolled Students',
          data: enrolled,
          backgroundColor: hexAlpha('#3b82f6', 0.65),
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: 'Active Students',
          data: active,
          backgroundColor: hexAlpha('#10b981', 0.85),
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: 'Total Attempts',
          data: attempts,
          backgroundColor: hexAlpha('#f59e0b', 0.85),
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 10,
            padding: 12,
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].label} Engagement`,
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const enr = enrolled[idx];
              const act = active[idx];
              const pct = enr > 0 ? ((act / enr) * 100).toFixed(1) : '0.0';
              const lck = gradeData[idx]?.locked_records || 0;
              return [
                `  Participation Rate : ${pct}% of grade`,
                `  Locked Records     : ${lck}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: '600' } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Student Count / Attempts',
            color: '#8fa3bf',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

/**
 * Chart B: Activity Progression Funnel — Horizontal Bar
 * @param {string} canvasId
 * @param {Object} kpiData {enrolled: 555, activeStudents: 45, attemptedStudents: 35, studentsWithLocks: 16}
 */
export function buildActivityFunnelChart(canvasId, kpiData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const enrolled = kpiData.enrolled ?? 0;
  const active = kpiData.activeStudents ?? 0;
  const attempted = kpiData.attemptedStudents ?? 0;
  const locked = kpiData.studentsWithLocks ?? 0;

  const labels = [
    'Enrolled Cohort',
    'Recorded Activity (≥1 Opened)',
    'Attempted (≥1 Attempt)',
    'Indicative Lockouts (≥1 Lock)',
  ];

  const data = [enrolled, active, attempted, locked];
  const barColors = [
    hexAlpha('#38bdf8', 0.85),
    hexAlpha('#3b82f6', 0.85),
    hexAlpha('#10b981', 0.85),
    hexAlpha('#ef4444', 0.85),
  ];
  const borderColors = ['#38bdf8', '#3b82f6', '#10b981', '#ef4444'];

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: barColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 32,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              const val = item.parsed.x;
              const pct = enrolled > 0 ? ((val / enrolled) * 100).toFixed(1) : '0.0';
              return [
                `  Count: ${val} students`,
                `  Share of Cohort: ${pct}%`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Number of Students',
            color: '#8fa3bf',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: '500' } },
        },
      },
    },
  });
}

/**
 * Chart C: Challenge Types & Attempt Distribution — Horizontal Grouped Bar
 * @param {string} canvasId
 * @param {Array} typeData [{challenge_type: 'boolean_circuit', attempts: 101, locked_records: 16, challenge_rows: 61, ...}]
 */
export function buildChallengeTypesChart(canvasId, typeData) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const labels = typeData.map(d => {
    const raw = d.challenge_type || 'Unknown';
    return raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  });

  const attempts = typeData.map(d => parseInt(d.attempts, 10) || 0);
  const locked = typeData.map(d => parseInt(d.locked_records, 10) || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Attempts',
          data: attempts,
          backgroundColor: hexAlpha('#06b6d4', 0.85),
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 20,
        },
        {
          label: 'Locked Records',
          data: locked,
          backgroundColor: hexAlpha('#ef4444', 0.85),
          borderColor: '#ef4444',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 10,
            padding: 12,
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].label} Challenges`,
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const row = typeData[idx];
              const rowsCount = row?.challenge_rows || 0;
              const stCount = row?.students || 0;
              const lockRate = row?.lock_rate || '0.0';
              return [
                `  Challenge Rows : ${rowsCount}`,
                `  Students Opened: ${stCount}`,
                `  Lockout Ratio  : ${lockRate}% (records locked / rows)`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Recorded Volume',
            color: '#8fa3bf',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: '500' } },
        },
      },
    },
  });
}

/**
 * Chart D: Most-Attempted Challenges — Ranked Horizontal Bar
 * @param {string} canvasId
 * @param {Array} topChallenges [{challengeId: 'logic-boolean_circuit-001', students_opened: 30, attempts: 50, locked_records: 10}]
 */
export function buildTopChallengesChart(canvasId, topChallenges) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx) return null;

  const dataSlice = topChallenges.slice(0, 6);
  const labels = dataSlice.map(d => {
    return d.challengeId.replace(/^logic-/, '').replace(/^debug-/, '');
  });

  const students = dataSlice.map(d => parseInt(d.students_opened, 10) || 0);
  const attempts = dataSlice.map(d => parseInt(d.attempts, 10) || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Students Opened',
          data: students,
          backgroundColor: hexAlpha('#8b5cf6', 0.85),
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 18,
        },
        {
          label: 'Total Attempts',
          data: attempts,
          backgroundColor: hexAlpha('#f59e0b', 0.85),
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 4,
          maxBarThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            boxWidth: 10,
            padding: 12,
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => `ID: ${dataSlice[items[0].dataIndex]?.challengeId}`,
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              const lck = dataSlice[idx]?.locked_records || 0;
              return [`  Locked Records : ${lck}`];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Count',
            color: '#8fa3bf',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10, family: 'monospace' } },
        },
      },
    },
  });
}




// ── Score-Based Analytics Charts ──────────────────────────────────────────

/**
 * Builds the Score Performance Distribution Chart (Performance Tiers)
 * @param {string} canvasId
 * @param {Object} distribution { mastery, proficient, developing, emerging, pending }
 * @returns Chart instance
 */
export function buildScoreDistributionChart(canvasId, distribution) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx || !distribution) return null;

  const labels = [
    'Mastery (≥5,000 pts)',
    'Proficient (2,500–4,999 pts)',
    'Developing (1,000–2,499 pts)',
    'Emerging (1–999 pts)',
    'Pending (0 pts)',
  ];

  const counts = [
    distribution.mastery || 0,
    distribution.proficient || 0,
    distribution.developing || 0,
    distribution.emerging || 0,
    distribution.pending || 0,
  ];

  const backgroundColors = [
    hexAlpha('#10b981', 0.85), // Emerald
    hexAlpha('#06b6d4', 0.85), // Cyan
    hexAlpha('#f59e0b', 0.85), // Amber
    hexAlpha('#f97316', 0.85), // Orange
    hexAlpha('#64748b', 0.65), // Slate
  ];

  const borderColors = [
    '#10b981',
    '#06b6d4',
    '#f59e0b',
    '#f97316',
    '#64748b',
  ];

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Student Count',
          data: counts,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const total = counts.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((item.parsed.y / total) * 100).toFixed(1) : 0;
              return ` ${item.parsed.y} students (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Students',
            color: '#8fa3bf',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
      },
    },
  });
}

/**
 * Builds Grade-Level Performance Comparison Chart
 * @param {string} canvasId
 * @param {Array} gradeScores [{ grade_label, enrolled, scored_count, avg_score, max_score }]
 * @returns Chart instance
 */
export function buildGradeScoreChart(canvasId, gradeScores) {
  const ctx = getCleanCanvas(canvasId);
  if (!ctx || !Array.isArray(gradeScores)) return null;

  const labels = gradeScores.map(g => g.grade_label);
  const avgScores = gradeScores.map(g => parseFloat(g.avg_score) || 0);
  const enrolled = gradeScores.map(g => parseInt(g.enrolled, 10) || 0);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Exam Score (pts)',
          data: avgScores,
          backgroundColor: hexAlpha('#38bdf8', 0.85),
          borderColor: '#38bdf8',
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: 'yScore',
          order: 1,
        },
        {
          label: 'Enrolled Cohort',
          data: enrolled,
          backgroundColor: hexAlpha('#8b5cf6', 0.35),
          borderColor: '#8b5cf6',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'yCohort',
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { usePointStyle: true, boxWidth: 10, padding: 12 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
        yScore: {
          position: 'left',
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: {
            display: true,
            text: 'Score (pts)',
            color: '#38bdf8',
            font: { size: 10 },
          },
          ticks: {
            callback: (v) => Number(v).toLocaleString(),
          },
        },
        yCohort: {
          position: 'right',
          beginAtZero: true,
          grid: { display: false },
          title: {
            display: true,
            text: 'Enrolled Students',
            color: '#8b5cf6',
            font: { size: 10 },
          },
          ticks: { precision: 0 },
        },
      },
    },
  });
}
