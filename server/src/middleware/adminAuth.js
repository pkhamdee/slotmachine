import { createHash } from 'crypto';

// Derived from ADMIN_PASSWORD so every replica produces the same token.
// A random-per-process token breaks multi-replica deployments: each pod issues
// a different token, so load-balanced requests to a different replica get 401.
export const adminSessionToken = createHash('sha256')
  .update(process.env.ADMIN_PASSWORD || '')
  .digest('hex');

export function requireAdminAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${adminSessionToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
