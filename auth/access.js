const EVENT_CONFIG = {
  '0542016a-b443-421e-9ae0-a4787697b945': {
    id: '0542016a-b443-421e-9ae0-a4787697b945',
    name: 'KLN PRELIMS',
    originalName: 'Madurai Tech Cup Demo (KLN School)',
    schoolName: 'KLN Vidyalaya CBSE Senior Secondary School',
    landingRoute: '/kln/dashboard',
  },
  'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89': {
    id: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89',
    name: 'Dolphin PRELIMS',
    originalName: 'Mock Exam - Madurai Tech Cup',
    schoolName: 'Dolphin PRELIMS',
    landingRoute: '/dolphin/dashboard',
  },
};

const ROLE_HOME = {
  super_admin: '/admin-overview',
  event_admin: '/admin-overview',
  school_admin: '/zone-dashboard',
  school_management: '/admin-overview',
  parent: '/parent-view',
};

function getHomeForRole(role, user = null) {
  if (user && user.eventId && EVENT_CONFIG[user.eventId]) {
    return EVENT_CONFIG[user.eventId].landingRoute;
  }
  return ROLE_HOME[role] || '/login';
}

function getSessionUser(req) {
  return req.session?.user || null;
}

function getScopedEventId(req) {
  const user = getSessionUser(req);
  return user?.eventId || null;
}

function canAccessEvent(req, eventId) {
  const user = getSessionUser(req);
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.eventId === eventId;
}

function getScopedSchool(req, requestedSchool) {
  const user = getSessionUser(req);
  if (!user) return requestedSchool;

  if (user.role === 'event_admin' && user.eventId) {
    if (user.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
      return 'KLN Vidyalaya CBSE Senior Secondary School';
    }
    if (user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
      return 'Dolphin PRELIMS';
    }
  }

  if (user.role === 'parent' && user.schoolName) {
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
  if (!user || user.role === 'super_admin') return schools;

  if (user.role === 'event_admin' && user.eventId) {
    if (user.eventId === '0542016a-b443-421e-9ae0-a4787697b945') {
      return schools.filter((row) => row[key] === 'KLN Vidyalaya CBSE Senior Secondary School');
    }
    if (user.eventId === 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89') {
      return [{ id: 'e4bd56c6-924d-49bb-9c3a-e2c74eab9f89', [key]: 'Dolphin PRELIMS' }];
    }
  }

  if (user.schoolName) {
    return schools.filter((row) => row[key] === user.schoolName);
  }
  return schools;
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
  EVENT_CONFIG,
  getHomeForRole,
  getSessionUser,
  getScopedEventId,
  canAccessEvent,
  getScopedSchool,
  getScopedStudentId,
  filterSchoolsForUser,
  enforceStudentAccess,
};
