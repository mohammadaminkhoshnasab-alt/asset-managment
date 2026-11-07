import { hash, verify } from '@node-rs/argon2';

/**
 * Validation result contract for authentication inputs
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates administrator username format and length constraints.
 */
export function validateUsername(username: unknown): ValidationResult {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) {
    return { valid: false, error: 'Username must be between 3 and 32 characters' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username may only contain letters, numbers, underscores, dots, and hyphens' };
  }
  return { valid: true };
}

/**
 * Validates administrator password strength.
 * Requires minimum 10 characters and max 128 characters.
 */
export function validatePasswordStrength(password: unknown): ValidationResult {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Password must be a string' };
  }
  if (password.length < 10) {
    return { valid: false, error: 'Password must be at least 10 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must not exceed 128 characters' };
  }
  return { valid: true };
}

// Argon2 algorithm enum numeric values (2 = Argon2id, the OWASP recommended standard)
export const ARGON2_ID_ALGORITHM = 2;

/**
 * Hashes an administrator password using the mature Argon2id algorithm.
 * Uses 19 MiB memory cost, 2 time cost iterations, and parallelism of 1 (OWASP recommended baseline).
 */
export async function hashPassword(password: string): Promise<string> {
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    throw new Error(strength.error || 'Invalid password');
  }

  return hash(password, {
    algorithm: ARGON2_ID_ALGORITHM,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Safely verifies a candidate plaintext password against an Argon2id hash.
 * Returns false rather than throwing on format errors or mismatches.
 */
export async function verifyPassword(passwordHash: string, candidate: string): Promise<boolean> {
  if (!passwordHash || typeof candidate !== 'string' || candidate.length === 0) {
    return false;
  }
  try {
    return await verify(passwordHash, candidate);
  } catch {
    return false;
  }
}
