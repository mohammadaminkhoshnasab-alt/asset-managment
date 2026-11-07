import { prisma } from '../db/client.ts';
import { hashPassword, validateUsername, validatePasswordStrength } from './password.ts';

export interface BootstrapInput {
  username: string;
  password: string;
}

export interface SanitizedAdmin {
  id: string;
  username: string;
  createdAt: Date;
}

export interface BootstrapResult {
  success: boolean;
  admin?: SanitizedAdmin;
  error?: string;
  code?: 'ALREADY_EXISTS' | 'INVALID_INPUT' | 'DATABASE_ERROR';
}

/**
 * Checks whether an administrator account has already been provisioned.
 */
export async function isAdminProvisioned(): Promise<boolean> {
  const count = await prisma.adminCredential.count();
  return count > 0;
}

/**
 * Securely and idempotently provisions the single administrator account.
 * Rejects creation if an administrator account already exists.
 */
export async function bootstrapAdministrator(input: BootstrapInput): Promise<BootstrapResult> {
  // 1. Input format validation
  const usernameCheck = validateUsername(input.username);
  if (!usernameCheck.valid) {
    return {
      success: false,
      error: usernameCheck.error,
      code: 'INVALID_INPUT',
    };
  }

  const passwordCheck = validatePasswordStrength(input.password);
  if (!passwordCheck.valid) {
    return {
      success: false,
      error: passwordCheck.error,
      code: 'INVALID_INPUT',
    };
  }

  // 2. Strict single-administrator check (idempotency check)
  const existingCount = await prisma.adminCredential.count();
  if (existingCount > 0) {
    return {
      success: false,
      error: 'An administrator account already exists. Only exactly ONE administrator account is permitted.',
      code: 'ALREADY_EXISTS',
    };
  }

  // 3. Hash password using Argon2id
  const passwordHash = await hashPassword(input.password);

  // 4. Create record in PostgreSQL
  const admin = await prisma.adminCredential.create({
    data: {
      username: input.username.trim(),
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    admin,
  };
}
