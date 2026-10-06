/**
 * api.js — Centralized fetch wrapper for the dashboard API
 */

const API_BASE = '/api/admin-overview';

/**
 * Core fetch utility. Returns parsed JSON or throws an error.
 * @param {string} path  Relative to API_BASE
 * @param {Object} params  Query params object
 */
async function apiFetch(path, params = {}) {
  // Remove null/undefined/empty params
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') clean[k] = v;
  }

  const qs = new URLSearchParams(clean).toString();
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Named endpoint helpers ─────────────────────────────────────

export function fetchFilters() {
  return apiFetch('/filters');
}

export function fetchSummary(params) {
  return apiFetch('/summary', params);
}

export function fetchZonePerformance(params) {
  return apiFetch('/zone-performance', params);
}

export function fetchProgressBands(params) {
  return apiFetch('/progress-bands', params);
}

export function fetchScoringBreakdown(params) {
  return apiFetch('/scoring-breakdown', params);
}

export function fetchZoneScoreRanges(params) {
  return apiFetch('/zone-score-ranges', params);
}

export function fetchTopStudents(params) {
  return apiFetch('/top-students', params);
}

export function fetchTopZones(params) {
  return apiFetch('/top-zones', params);
}

// ── Event Insights API ─────────────────────────────────────────

const EVENT_API_BASE = '/api/event-insights';

export async function fetchEventList() {
  const res = await fetch(`${EVENT_API_BASE}/events`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /events → ${res.status}`);
  return res.json();
}

export async function fetchEventOverview(id) {
  const res = await fetch(`${EVENT_API_BASE}/${encodeURIComponent(id)}/overview`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /:id/overview → ${res.status}`);
  return res.json();
}

export async function fetchEventGrades(id) {
  const res = await fetch(`${EVENT_API_BASE}/${encodeURIComponent(id)}/grades`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /:id/grades → ${res.status}`);
  return res.json();
}

export async function fetchEventTrend(id) {
  const res = await fetch(`${EVENT_API_BASE}/${encodeURIComponent(id)}/registration-trend`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /:id/registration-trend → ${res.status}`);
  return res.json();
}

export async function fetchEventComparison() {
  const res = await fetch(`${EVENT_API_BASE}/comparison`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /comparison → ${res.status}`);
  return res.json();
}

export async function fetchEventParticipants(id, params = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') clean[k] = v;
  }
  const qs = new URLSearchParams(clean).toString();
  const res = await fetch(`${EVENT_API_BASE}/${encodeURIComponent(id)}/participants${qs ? '?' + qs : ''}`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /:id/participants → ${res.status}`);
  return res.json();
}

export async function fetchEventPerformance(id) {
  const res = await fetch(`${EVENT_API_BASE}/${encodeURIComponent(id)}/performance`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API /:id/performance → ${res.status}`);
  return res.json();
}

