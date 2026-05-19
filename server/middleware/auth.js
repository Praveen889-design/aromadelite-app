const jwt = require('jsonwebtoken');

// In-memory token blacklist. For multi-instance deploys, swap for Redis.
const blacklist = new Map();

const sweep = () => {
  const now = Math.floor(Date.now() / 1000);
  for (const [tok, exp] of blacklist) if (exp <= now) blacklist.delete(tok);
};
setInterval(sweep, 60_000).unref?.();

const blacklistToken = (token, exp) => {
  if (token) blacklist.set(token, exp || Math.floor(Date.now() / 1000) + 3600);
};

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  if (blacklist.has(token)) return res.status(401).json({ error: 'Token revoked' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = { requireAuth, requireRole, blacklistToken };
