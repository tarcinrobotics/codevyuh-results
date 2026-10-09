(function () {
  async function fetchMe() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();
    return data.user;
  }

  function roleLabel(user) {
    if (!user) return 'User';
    if (typeof user === 'string') {
      return {
        super_admin: 'Super Admin',
        event_admin: 'Event Admin',
        school_admin: 'School Admin',
        school_management: 'School Management',
        parent: 'Parent',
      }[user] || user;
    }
    if (user.role === 'event_admin') {
      return user.eventName ? `${user.eventName} Admin` : 'Event Admin';
    }
    return {
      super_admin: 'Super Admin',
      school_admin: 'School Admin',
      school_management: 'School Management',
      parent: 'Parent',
    }[user.role] || user.role;
  }

  function allowedRoutes(role) {
    const common = new Set([]);
    if (role === 'super_admin' || role === 'event_admin') {
      return new Set(['/admin-overview', '/zone-dashboard', '/parent-view', '/user-management']);
    }
    if (role === 'school_admin') {
      return new Set(['/zone-dashboard']);
    }
    if (role === 'school_management') {
      return new Set(['/admin-overview']);
    }
    if (role === 'parent') {
      return new Set(['/parent-view']);
    }
    return common;
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
    } catch (_) {}
    window.location.href = '/login';
  }

  function renderTopbarAuth(user) {
    const right = document.querySelector('.topbar-right');
    if (!right) return;

    right.querySelectorAll('[data-auth-control]').forEach((el) => el.remove());

    if (user.role === 'super_admin' || user.role === 'event_admin') {
      const manage = document.createElement('a');
      manage.href = '/user-management';
      manage.className = 'topbar-btn';
      manage.dataset.authControl = 'true';
      manage.innerHTML = '<i data-lucide="shield-check"></i><span>User Access</span>';
      right.insertBefore(manage, right.firstChild);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'topbar-btn';
    logoutBtn.dataset.authControl = 'true';
    logoutBtn.innerHTML = '<i data-lucide="log-out"></i><span>Logout</span>';
    logoutBtn.addEventListener('click', logout);

    const chip = document.createElement('div');
    chip.className = 'user-chip';
    chip.dataset.authControl = 'true';
    chip.innerHTML = `
      <div class="user-chip-avatar">${(user.displayName || user.username || '?').charAt(0).toUpperCase()}</div>
      <div class="user-chip-meta">
        <span class="user-chip-name">${user.displayName || user.username}</span>
        <span class="user-chip-role">${roleLabel(user)}</span>
      </div>
    `;

    right.insertBefore(logoutBtn, right.firstChild);
    right.insertBefore(chip, right.firstChild);

    if (window.lucide) lucide.createIcons();
  }

  function applyNavAccess(user) {
    const allow = allowedRoutes(user.role);
    document.querySelectorAll('.topbar-nav a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http')) return;
      if (!allow.has(href)) {
        link.style.display = 'none';
      }
    });

    document.querySelectorAll('.route-select option').forEach((opt) => {
      const val = opt.getAttribute('value');
      if (val && !allow.has(val)) {
        opt.remove();
      }
    });
  }

  async function initAuthClient() {
    try {
      const user = await fetchMe();
      window.currentAuthUser = user;
      renderTopbarAuth(user);
      applyNavAccess(user);
      window.dispatchEvent(new CustomEvent('auth:ready', { detail: user }));
    } catch (err) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?returnTo=${returnTo}`;
    }
  }

  document.addEventListener('DOMContentLoaded', initAuthClient);
})();
