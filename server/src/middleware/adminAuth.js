import { randomBytes } from 'crypto';

// One-time token generated on server start — invalidated on restart
export const adminSessionToken = randomBytes(32).toString('hex');

export function requireAdminAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${adminSessionToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
