import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.ts';

// -------------------------------------------------------------
// IP-based Login Rate Limiter (sliding window)
// -------------------------------------------------------------

interface RateLimitRecord {
  timestamps: number[];
}

const loginIpAttempts = new Map<string, RateLimitRecord>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_LOGIN_REQUESTS_PER_WINDOW = 10; // Max 10 attempts per minute per IP

/**
 * Middleware: IP Rate Limiting on authentication endpoints.
 * Protects against aggressive automated brute-force attacks.
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();

  let record = loginIpAttempts.get(ip);
  if (!record) {
    record = { timestamps: [] };
    loginIpAttempts.set(ip, record);
  }

  // Filter timestamps within window
  record.timestamps = record.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (record.timestamps.length >= MAX_LOGIN_REQUESTS_PER_WINDOW) {
    res.set('Retry-After', '60');
    res.status(429).json({
      status: 'error',
      error: 'Too many login attempts. Please try again after 60 seconds.',
    });
    return;
  }

  record.timestamps.push(now);
  next();
}

/**
 * Reset rate limit tracker for tests or manual unlock.
 */
export function resetIpRateLimits(): void {
  loginIpAttempts.clear();
}

// -------------------------------------------------------------
// Administrator Account-Level Lockout (Stored in PostgreSQL)
// -------------------------------------------------------------

export const MAX_CONSECUTIVE_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Verifies if an administrator account is currently locked.
 */
export function isAccountLocked(admin: { lockedUntil: Date | null }): {
  locked: boolean;
  remainingMinutes?: number;
} {
  if (!admin.lockedUntil) {
    return { locked: false };
  }

  const now = new Date();
  if (admin.lockedUntil > now) {
    const diffMs = admin.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)));
    return { locked: true, remainingMinutes };
  }

  return { locked: false };
}

/**
 * Increments failed attempts counter for an administrator account.
 * Locks the account for 15 minutes if attempts reach MAX_CONSECUTIVE_FAILED_ATTEMPTS.
 */
export async function recordFailedAttempt(username: string): Promise<{
  locked: boolean;
  attempts: number;
}> {
  const admin = await prisma.adminCredential.findUnique({ where: { username } });
  if (!admin) {
    return { locked: false, attempts: 0 };
  }

  const newAttempts = admin.failedAttempts + 1;
  const shouldLock = newAttempts >= MAX_CONSECUTIVE_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : admin.lockedUntil;

  await prisma.adminCredential.update({
    where: { username },
    data: {
      failedAttempts: newAttempts,
      lockedUntil,
    },
  });

  return {
    locked: shouldLock,
    attempts: newAttempts,
  };
}

/**
 * Resets failed attempts and unlocks account upon successful authentication.
 */
export async function resetFailedAttempts(username: string): Promise<void> {
  await prisma.adminCredential.updateMany({
    where: { username },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}
