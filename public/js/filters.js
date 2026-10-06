/**
 * filters.js — Filter bar state management
 * Manages the filter dropdowns and notifies listeners on change.
 */

let _state = {
  zone:    null,
  status:  null,   // null | 'active' | 'inactive'
};

const _listeners = new Set();
let _zoneLocked = false;

/** Subscribe to filter changes */
export function onFilterChange(fn) {
  _listeners.add(fn);
}

/** Get current filter state */
export function getFilters() {
  return { ..._state };
}

/** Initialize dropdowns with data from the API */
export function populateFilters({ zones = [] }) {
  // ── Zone dropdown
  const zoneSelect = document.getElementById('filter-zone');
  if (zoneSelect) {
    const current = zoneSelect.value;
    const authUser = window.currentAuthUser || null;
    const lockedZone = authUser?.role === 'school_management' ? authUser.schoolName : null;
    const visibleZones = lockedZone ? zones.filter(z => z === lockedZone) : zones;

    zoneSelect.innerHTML = lockedZone
      ? ''
      : '<option value="">All Schools</option>';
    visibleZones.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z;
      if ((lockedZone && z === lockedZone) || (!lockedZone && z === current)) opt.selected = true;
      zoneSelect.appendChild(opt);
    });

    if (lockedZone) {
      zoneSelect.value = lockedZone;
      zoneSelect.disabled = true;
      _zoneLocked = true;
      _state.zone = lockedZone;
    } else {
      zoneSelect.disabled = false;
      _zoneLocked = false;
    }
  }
}

/** Wire up all filter dropdowns */
export function initFilters() {
  const zoneEl   = document.getElementById('filter-zone');
  const statusEl = document.getElementById('filter-status');
  const clearBtn = document.getElementById('btn-clear-filters');

  function notify() {
    _state = {
      zone:    zoneEl?.value   || null,
      status:  statusEl?.value || null,
    };
    _listeners.forEach(fn => fn({ ..._state }));
    updateFilterBadges();
  }

  zoneEl?.addEventListener('change', notify);
  statusEl?.addEventListener('change', notify);

  clearBtn?.addEventListener('click', () => {
    if (zoneEl && !_zoneLocked) zoneEl.value = '';
    if (statusEl) statusEl.value = '';
    notify();
  });

  window.addEventListener('auth:ready', () => {
    if (_zoneLocked) notify();
  });
}

function updateFilterBadges() {
  const activeCount = [_state.zone, _state.status]
    .filter(Boolean).length;

  const badge = document.getElementById('filter-active-badge');
  if (badge) {
    badge.textContent = activeCount > 0 ? `${activeCount} active` : '';
    badge.style.display = activeCount > 0 ? 'inline-flex' : 'none';
  }

  const statusText = document.getElementById('filter-status-text');
  if (statusText) {
    const parts = [];
    if (_state.zone)   parts.push(_state.zone);
    if (_state.status)  parts.push(_state.status === 'active' ? '🟢 active schools' : '🔴 inactive schools');
    statusText.innerHTML = parts.length
      ? `Showing: <span>${parts.join(' · ')}</span>`
      : 'Showing all data';
  }
}
