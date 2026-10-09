const path = require('path');
const { getHomeForRole, getSessionUser, canAccessEvent } = require('./access');

function requireRoles(roles, mode = 'page') {
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) {
      if (mode === 'api') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const returnTo = encodeURIComponent(req.originalUrl || '/');
      return res.redirect(`/login?returnTo=${returnTo}`);
    }

    if (!roles.includes(user.role)) {
      if (mode === 'api') {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.redirect(getHomeForRole(user.role, user));
    }

    req.authUser = user;
    next();
  };
}

function requireEventAccess(targetEventId, mode = 'page') {
  return (req, res, next) => {
    const user = getSessionUser(req);
    if (!user) {
      if (mode === 'api') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const returnTo = encodeURIComponent(req.originalUrl || '/');
      return res.redirect(`/login?returnTo=${returnTo}`);
    }

    if (!canAccessEvent(req, targetEventId)) {
      if (mode === 'api') {
        return res.status(403).json({ error: 'Access denied: Unauthorized event access' });
      }
      return res.redirect(getHomeForRole(user.role, user));
    }

    req.authUser = user;
    next();
  };
}

function blockProtectedStaticFiles() {
  const protectedFiles = new Map([
    ['/admin-overview.html', ['super_admin', 'event_admin', 'school_management', 'school_admin']],
    ['/zone-dashboard.html', ['super_admin', 'event_admin', 'school_admin', 'school_management']],
    ['/parent-view.html', ['super_admin', 'event_admin', 'parent']],
    ['/student-report.html', ['super_admin', 'event_admin', 'parent']],
    ['/user-management.html', ['super_admin', 'event_admin']],
  ]);

  return (req, res, next) => {
    const roles = protectedFiles.get(req.path);
    if (!roles) return next();
    return requireRoles(roles, 'page')(req, res, next);
  };
}

function serveProtectedPage(relativePath, roles) {
  return [
    requireRoles(roles, 'page'),
    (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', relativePath));
    },
  ];
}

module.exports = {
  requirePageRoles: (roles) => requireRoles(roles, 'page'),
  requireApiRoles: (roles) => requireRoles(roles, 'api'),
  requireEventAccess,
  blockProtectedStaticFiles,
  serveProtectedPage,
};
