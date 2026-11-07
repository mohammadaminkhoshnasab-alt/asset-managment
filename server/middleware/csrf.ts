import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Generates a cryptographically strong 256-bit random CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates request Origin and Referer headers against the host to prevent cross-origin abuse.
 */
function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const host = req.headers['host'];

  if (!host) {
    return true; // Direct internal programmatic calls
  }

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const parsedReferer = new URL(referer);
      if (parsedReferer.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * CSRF Protection Middleware for session-based endpoints.
 * Safe methods (GET, HEAD, OPTIONS) are permitted.
 * State-changing methods (POST, PUT, DELETE, PATCH) require:
 * 1. Valid origin/referer check matching request host.
 * 2. Valid X-CSRF-Token header matching req.session.csrfToken for authenticated requests.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // 1. Cross-Origin verification
  if (!isAllowedOrigin(req)) {
    res.status(403).json({
      status: 'error',
      error: 'Cross-origin request blocked by CSRF policy',
    });
    return;
  }

  // 2. State-changing requests within an active authenticated session require a matching CSRF token
  // Public login exempts token requirement if no session was yet established,
  // but still validates origin/referer.
  const isPublicAuthRoute = req.path === '/api/auth/login' || req.path === '/auth/login';

  if (!isPublicAuthRoute && req.session && req.session.adminId) {
    const clientToken = req.headers['x-csrf-token'] || req.body?._csrf;
    const sessionToken = req.session.csrfToken;

    if (!sessionToken || !clientToken || clientToken !== sessionToken) {
      res.status(403).json({
        status: 'error',
        error: 'Invalid or missing CSRF token',
      });
      return;
    }
  }

  next();
}
