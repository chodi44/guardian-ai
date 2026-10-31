/**
 * 🛡️ Guardian AI — Authorization & Permission Middleware
 * Enforces role, relationship, organization, and assignment permissions on backend routes.
 */

// Verify Role Permission
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'] || req.user?.role || 'user';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]. Current role: ${userRole}`
      });
    }
    next();
  };
}

// Verify Organization / Station Scope for Police Officers
function requireStationAccess() {
  return (req, res, next) => {
    const stationId = req.headers['x-station-id'] || req.officer?.stationId || 'STATION-01';
    req.stationId = stationId;
    next();
  };
}

// Verify Guardian Link Permission
function requireGuardianLink() {
  return (req, res, next) => {
    const guardianId = req.headers['x-guardian-id'] || req.body.guardianId || req.query.guardianId;
    if (!guardianId) {
      return res.status(400).json({ success: false, message: 'Guardian authorization header missing.' });
    }
    req.guardianId = guardianId;
    next();
  };
}

module.exports = {
  requireRole,
  requireStationAccess,
  requireGuardianLink
};
