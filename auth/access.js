const ROLE_HOME = {
  super_admin: '/admin-overview',
  school_admin: '/zone-dashboard',
  school_management: '/admin-overview',
  parent: '/parent-view',
};

function getHomeForRole(role) {
  return ROLE_HOME[role] || '/login';
}

function getSessionUser(req) {
  return req.session?.user || null;
}

function getScopedSchool(req, requestedSchool) {
  const user = getSessionUser(req);
  if (user && user.role === 'parent' && user.schoolName) {
    return user.schoolName;
  }
  return requestedSchool;
}

function getScopedStudentId(req, requestedStudentId) {
  const user = getSessionUser(req);
  if (user && user.role === 'parent' && user.studentId) {
    return user.studentId;
  }
  return requestedStudentId;
}

function filterSchoolsForUser(req, schools, key = 'name') {
  const user = getSessionUser(req);
  if (!user || !user.schoolName || user.role === 'super_admin') return schools;
  return schools.filter((row) => row[key] === user.schoolName);
}

function enforceStudentAccess(req, schoolName, studentId) {
  const user = getSessionUser(req);
  if (!user || user.role === 'super_admin') return true;
  if (user.role !== 'parent') return false;
  if (user.schoolName && schoolName && user.schoolName !== schoolName) return false;
  if (user.studentId && studentId && user.studentId !== studentId) return false;
  return true;
}

module.exports = {
  getHomeForRole,
  getSessionUser,
  getScopedSchool,
  getScopedStudentId,
  filterSchoolsForUser,
  enforceStudentAccess,
};
