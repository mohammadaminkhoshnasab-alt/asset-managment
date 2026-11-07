import type { Request, Response, NextFunction } from 'express';

/**
 * Reusable authentication middleware protecting administrative backend endpoints.
 * Requires a verified server-side session with an active adminId.
 * Never bypasses authentication for local loopback or private-network origins.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.adminId) {
    res.status(401).json({
      status: 'error',
      error: 'Authentication required. No active administrator session found.',
    });
    return;
  }

  // Attach authenticated administrator context
  req.admin = {
    id: req.session.adminId,
    username: req.session.username || 'admin',
  };

  next();
}
