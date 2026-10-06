const path = require('path');
const { getHomeForRole, getSessionUser } = require('./access');

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
      return res.redirect(getHomeForRole(user.role));
    }

    req.authUser = user;
    next();
  };
}

function blockProtectedStaticFiles() {
  const protectedFiles = new Map([
    ['/admin-overview.html', ['super_admin', 'school_admin']],
    ['/zone-dashboard.html', ['super_admin', 'school_management']],
    ['/parent-view.html', ['super_admin', 'parent']],
    ['/student-report.html', ['super_admin', 'parent']],
    ['/user-management.html', ['super_admin']],
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
  blockProtectedStaticFiles,
  serveProtectedPage,
};
