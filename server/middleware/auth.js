const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'oscarsoft_turnos_jwt_super_secret_key_2026!';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  try {
    return jwt.verify(parts[1], JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ status: 'error', message: 'No autorizado. Por favor inicia sesión.' });
  }
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  const user = verifyToken(req);
  if (user) req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'No autenticado.' });
    }
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.user.rol)) {
      return res.status(403).json({ status: 'error', message: 'Permiso denegado para esta acción.' });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  requireAuth,
  optionalAuth,
  requireRole
};
