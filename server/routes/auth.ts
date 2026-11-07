import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db/client.ts';
import { verifyPassword, validateUsername } from '../auth/password.ts';
import {
  loginRateLimiter,
  isAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} from '../auth/rateLimiter.ts';
import { generateCsrfToken } from '../middleware/csrf.ts';
import { requireAdmin } from '../middleware/requireAdmin.ts';

export const authRouter = Router();

/**
 * GET /api/auth/csrf
 * Returns a cryptographically secure CSRF token for the current session.
 */
authRouter.get('/csrf', (req: Request, res: Response) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  res.status(200).json({
    status: 'ok',
    csrfToken: req.session.csrfToken,
  });
});

/**
 * POST /api/auth/login
 * Authenticates the single administrator, regenerates session ID, and issues CSRF token.
 */
authRouter.post('/login', loginRateLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body || {};

  // 1. Basic input validation
  const userValidation = validateUsername(username);
  if (!userValidation.valid || typeof password !== 'string' || password.length === 0) {
    res.status(400).json({
      status: 'error',
      error: 'Username and password are required and must be valid strings',
    });
    return;
  }

  const trimmedUsername = username.trim();

  try {
    // 2. Fetch administrator record from PostgreSQL
    const admin = await prisma.adminCredential.findUnique({
      where: { username: trimmedUsername },
    });

    if (!admin) {
      // Return 401 without revealing whether the username exists
      res.status(401).json({
        status: 'error',
        error: 'Invalid username or password',
      });
      return;
    }

    // 3. Verify account lockout
    const lock = isAccountLocked(admin);
    if (lock.locked) {
      res.status(423).json({
        status: 'error',
        error: `Account is temporarily locked due to excessive failed attempts. Please try again in ${lock.remainingMinutes} minutes.`,
      });
      return;
    }

    // 4. Verify password with Argon2id
    const isValid = await verifyPassword(admin.passwordHash, password);

    if (!isValid) {
      const failed = await recordFailedAttempt(trimmedUsername);
      if (failed.locked) {
        res.status(423).json({
          status: 'error',
          error: 'Account locked due to 5 consecutive failed attempts. Please try again after 15 minutes.',
        });
        return;
      }

      res.status(401).json({
        status: 'error',
        error: 'Invalid username or password',
      });
      return;
    }

    // 5. Successful authentication: reset failed attempts
    await resetFailedAttempts(trimmedUsername);

    // 6. Regenerate session to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).json({
          status: 'error',
          error: 'Failed to initialize authenticated session',
        });
        return;
      }

      // Establish session identity
      req.session.adminId = admin.id;
      req.session.username = admin.username;
      req.session.csrfToken = generateCsrfToken();

      res.status(200).json({
        status: 'ok',
        message: 'Login successful',
        admin: {
          id: admin.id,
          username: admin.username,
        },
        csrfToken: req.session.csrfToken,
      });
    });
  } catch (err: any) {
    console.error('[AuthError] Login failed:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Internal authentication service error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroys server-side session and clears cookie.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  if (!req.session) {
    res.status(200).json({
      status: 'ok',
      message: 'Already logged out',
    });
    return;
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[AuthError] Session destruction error:', err);
    }
    res.clearCookie('it_asset_sess');
    res.status(200).json({
      status: 'ok',
      message: 'Logged out successfully',
    });
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated administrator context.
 * Protected by requireAdmin middleware.
 */
authRouter.get('/me', requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = await prisma.adminCredential.findUnique({
      where: { id: req.session.adminId },
      select: {
        id: true,
        username: true,
        passwordUpdatedAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      res.status(401).json({
        status: 'error',
        error: 'Active administrator account not found',
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      authenticated: true,
      admin,
      csrfToken: req.session.csrfToken,
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve administrator profile',
    });
  }
});

/**
 * Explicit rejection of public registration endpoint.
 */
authRouter.all('/register', (_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    error: 'Public registration is not supported. Single administrator must be provisioned via CLI.',
  });
});
