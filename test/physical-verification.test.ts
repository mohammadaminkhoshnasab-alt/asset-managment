import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatePrecision, VerificationOutcome } from '@prisma/client';
import { createExpressApp } from '../server/app.ts';
import {
  validateCreateVerificationInput,
  validateVerificationPaginationQuery,
  isValidGregorianDate,
  isLeapYear,
  getMaxDaysInMonth,
  VALID_VERIFICATION_OUTCOMES,
  VALID_DATE_PRECISIONS,
} from '../server/validators/verificationValidators.ts';
import { compareVerificationChronology } from '../server/services/verificationService.ts';
import { validatePatchAssetInput } from '../server/validators/assetValidators.ts';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const initMigrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20261107000000_init_postgresql_schema/migration.sql'
);

// ---------------------------------------------------------------------------
// 1. Validator Tests (Pure Logic)
// ---------------------------------------------------------------------------

test('P11 Validators: validateCreateVerificationInput rejects non-object input', () => {
  const result = validateCreateVerificationInput(null);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Request body must be a JSON object');
});

test('P11 Validators: validateCreateVerificationInput rejects forbidden fields', () => {
  const forbiddenAttempts = [
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, id: 'some-id' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, assetId: '00000000-0000-4000-a000-000000000001' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, verifiedBy: 'admin' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, createdAt: new Date().toISOString() },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, lastVerifiedAt: new Date().toISOString() },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, actor: 'spoofed_admin' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, operationId: '00000000-0000-4000-a000-000000000002' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, status: 'IN_USE' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, locationId: '00000000-0000-4000-a000-000000000003' },
    { outcome: 'VERIFIED_MATCH', datePrecision: 'DAY', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 8, model: 'ThinkPad T14' },
  ];

  for (const attempt of forbiddenAttempts) {
    const result = validateCreateVerificationInput(attempt);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'FORBIDDEN_FIELD');
  }
});

test('P11 Validators: validateCreateVerificationInput rejects unknown fields', () => {
  const result = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
    unauthorizedRandomField: 'malicious',
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'UNKNOWN_FIELD');
});

test('P11 Validators: validateCreateVerificationInput requires and validates outcome enum', () => {
  // Missing outcome
  const missingRes = validateCreateVerificationInput({
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(missingRes.valid, false);
  assert.equal(missingRes.code, 'MISSING_REQUIRED');

  // Invalid enum string
  const invalidRes = validateCreateVerificationInput({
    outcome: 'PARTIALLY_VERIFIED', // Non-existent enum
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(invalidRes.valid, false);
  assert.equal(invalidRes.code, 'INVALID_FORMAT');
  assert.ok(invalidRes.error.includes('Invalid outcome'));

  // All 6 valid enums accepted
  const expectedOutcomes = [
    'VERIFIED_MATCH',
    'LOCATION_MISMATCH',
    'USER_MISMATCH',
    'STATUS_MISMATCH',
    'NOT_FOUND',
    'DAMAGED',
  ];
  for (const outcome of expectedOutcomes) {
    const validRes = validateCreateVerificationInput({
      outcome,
      datePrecision: 'DAY',
      verifiedYear: 2026,
      verifiedMonth: 11,
      verifiedDay: 8,
    });
    assert.equal(validRes.valid, true);
    if (validRes.valid) {
      assert.equal(validRes.data.outcome, outcome);
    }
  }
});

test('P11 Validators: isSuccessful semantics distinction (defaults to true; supports false)', () => {
  // Omitted isSuccessful defaults to true
  const defaultRes = validateCreateVerificationInput({
    outcome: 'LOCATION_MISMATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(defaultRes.valid, true);
  if (defaultRes.valid) {
    assert.equal(defaultRes.data.isSuccessful, true);
  }

  // Explicit isSuccessful = false (e.g. inspection attempt aborted/device inaccessible)
  const falseRes = validateCreateVerificationInput({
    outcome: 'NOT_FOUND',
    isSuccessful: false,
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(falseRes.valid, true);
  if (falseRes.valid) {
    assert.equal(falseRes.data.isSuccessful, false);
  }

  // Reject non-boolean
  const badTypeRes = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    isSuccessful: 'yes',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(badTypeRes.valid, false);
  assert.equal(badTypeRes.field, 'isSuccessful');
});

test('P11 Validators: Calendar date validation, leap years, and impossible dates', () => {
  // Leap year helper checks
  assert.equal(isLeapYear(2024), true); // Divisible by 4
  assert.equal(isLeapYear(2023), false); // Odd year
  assert.equal(isLeapYear(2000), true); // 400-year leap
  assert.equal(isLeapYear(1900), false); // 100-year non-leap

  // Days in month
  assert.equal(getMaxDaysInMonth(2024, 2), 29);
  assert.equal(getMaxDaysInMonth(2023, 2), 28);
  assert.equal(getMaxDaysInMonth(2026, 4), 30);
  assert.equal(getMaxDaysInMonth(2026, 7), 31);

  // Feb 29 in leap year: VALID
  const leapValid = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2024,
    verifiedMonth: 2,
    verifiedDay: 29,
  });
  assert.equal(leapValid.valid, true);

  // Feb 29 in non-leap year: REJECTED
  const leapInvalid = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2023,
    verifiedMonth: 2,
    verifiedDay: 29,
  });
  assert.equal(leapInvalid.valid, false);
  assert.equal(leapInvalid.code, 'INVALID_FORMAT');
  assert.ok(leapInvalid.error.includes('has at most 28 days'));

  // April 31: REJECTED (April has 30 days)
  const april31 = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 4,
    verifiedDay: 31,
  });
  assert.equal(april31.valid, false);
  assert.ok(april31.error.includes('has at most 30 days'));

  // Month 13: REJECTED
  const month13 = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 13,
    verifiedDay: 10,
  });
  assert.equal(month13.valid, false);

  // Day 0: REJECTED
  const day0 = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 5,
    verifiedDay: 0,
  });
  assert.equal(day0.valid, false);
});

test('P11 Validators: MONTH precision enforces null-day invariant without guessing', () => {
  // Valid MONTH precision: verifiedDay is omitted
  const monthValid = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
  });
  assert.equal(monthValid.valid, true);
  if (monthValid.valid) {
    assert.equal(monthValid.data.datePrecision, 'MONTH');
    assert.equal(monthValid.data.verifiedYear, 2026);
    assert.equal(monthValid.data.verifiedMonth, 11);
    assert.equal(monthValid.data.verifiedDay, null);
    assert.equal(monthValid.data.verifiedDate, null);
    assert.equal(monthValid.data.verifiedYearMonth, '2026-11');
  }

  // Reject if client attempts to pass verifiedDay with MONTH precision
  const monthWithDay = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 1, // Prohibited for MONTH precision
  });
  assert.equal(monthWithDay.valid, false);
  assert.equal(monthWithDay.code, 'FORBIDDEN_FIELD');
  assert.ok(monthWithDay.error.includes("When datePrecision is 'MONTH', 'verifiedDay' must not be provided"));
});

test('P11 Validators: DAY precision stores timezone-safe date and YYYY-MM string', () => {
  const dayValid = validateCreateVerificationInput({
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
  });
  assert.equal(dayValid.valid, true);
  if (dayValid.valid) {
    assert.equal(dayValid.data.verifiedDay, 8);
    assert.equal(dayValid.data.verifiedYearMonth, '2026-11');
    assert.ok(dayValid.data.verifiedDate instanceof Date);
    // UTC date components are preserved
    assert.equal(dayValid.data.verifiedDate.getUTCFullYear(), 2026);
    assert.equal(dayValid.data.verifiedDate.getUTCMonth(), 10); // 0-indexed
    assert.equal(dayValid.data.verifiedDate.getUTCDate(), 8);
  }
});

test('P11 Validators: validateVerificationPaginationQuery enforces bounds and defaults', () => {
  // Default values
  const def = validateVerificationPaginationQuery({});
  assert.equal(def.valid, true);
  if (def.valid) {
    assert.equal(def.data.page, 1);
    assert.equal(def.data.limit, 20);
  }

  // Custom valid
  const custom = validateVerificationPaginationQuery({ page: 2, limit: 50 });
  assert.equal(custom.valid, true);
  if (custom.valid) {
    assert.equal(custom.data.page, 2);
    assert.equal(custom.data.limit, 50);
  }

  // Invalid page < 1
  const badPage = validateVerificationPaginationQuery({ page: 0 });
  assert.equal(badPage.valid, false);

  // Invalid limit > 100
  const badLimit = validateVerificationPaginationQuery({ limit: 101 });
  assert.equal(badLimit.valid, false);
});

// ---------------------------------------------------------------------------
// 2. Chronological Ordering & Summary Policy Tests (Pure Logic)
// ---------------------------------------------------------------------------

test('P11 Chronology: compareVerificationChronology orders years and months deterministically', () => {
  const olderYear = {
    verifiedYear: 2025,
    verifiedMonth: 12,
    verifiedDay: 31,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2025-12-31T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000001',
  };

  const newerYear = {
    verifiedYear: 2026,
    verifiedMonth: 1,
    verifiedDay: 1,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000002',
  };

  // compareVerificationChronology(a, b): > 0 means b is newer, < 0 means a is newer
  assert.ok(compareVerificationChronology(olderYear, newerYear) > 0);
  assert.ok(compareVerificationChronology(newerYear, olderYear) < 0);

  // Same year, different months
  const oct = {
    verifiedYear: 2026,
    verifiedMonth: 10,
    verifiedDay: 25,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-10-25T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000003',
  };
  const nov = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 1,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000004',
  };
  assert.ok(compareVerificationChronology(oct, nov) > 0);
});

test('P11 Chronology: DAY precision orders by day within same month', () => {
  const day5 = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 5,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-11-05T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000005',
  };
  const day20 = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 20,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-11-20T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000006',
  };
  assert.ok(compareVerificationChronology(day5, day20) > 0);
});

test('P11 Chronology: Same-month DAY vs MONTH avoids fabricating days and uses createdAt deterministically', () => {
  const daySpecific = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 15,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-11-15T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000007',
  };

  const monthGeneralLater = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: null,
    datePrecision: DatePrecision.MONTH,
    createdAt: new Date('2026-11-28T10:00:00Z'),
    id: '00000000-0000-4000-a000-000000000008',
  };

  // Same year and month: later recorded observation takes precedence without inventing a false day
  assert.ok(compareVerificationChronology(daySpecific, monthGeneralLater) > 0);
});

// ---------------------------------------------------------------------------
// 3. Schema & Database Invariants
// ---------------------------------------------------------------------------

test('P11 Schema: PhysicalVerification model contains all required columns and relations', () => {
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.ok(schema.includes('model PhysicalVerification {'));
  assert.ok(schema.includes('verifiedBy    String              @map("verified_by")'));
  assert.ok(schema.includes('outcome       VerificationOutcome @map("outcome")'));
  assert.ok(schema.includes('isSuccessful  Boolean             @default(true) @map("is_successful")'));
  assert.ok(schema.includes('datePrecision DatePrecision       @default(DAY) @map("date_precision")'));
  assert.ok(schema.includes('verifiedYear  Int                 @map("verified_year")'));
  assert.ok(schema.includes('verifiedMonth Int                 @map("verified_month")'));
  assert.ok(schema.includes('verifiedDay   Int?                @map("verified_day")'));
  assert.ok(schema.includes('verifiedDate  DateTime?           @map("verified_date")'));
  assert.ok(schema.includes('verifiedYearMonth String?         @map("verified_year_month")'));
  assert.ok(schema.includes('notes         String?             @map("notes")'));
  assert.ok(schema.includes('createdAt     DateTime            @default(now()) @map("created_at")'));
});

test('P11 Schema: Migration SQL defines date precision check constraint and foreign key restrict', () => {
  const migration = fs.readFileSync(initMigrationPath, 'utf8');

  // Precision check: DAY requires non-null verified_day; MONTH requires null verified_day
  assert.ok(
    migration.includes(
      '("date_precision" = \'DAY\' AND "verified_day" IS NOT NULL) OR'
    )
  );
  assert.ok(
    migration.includes(
      '("date_precision" = \'MONTH\' AND "verified_day" IS NULL)'
    )
  );

  // Foreign key restrict to prevent cascade deletion
  assert.ok(
    migration.includes(
      'ALTER TABLE "physical_verifications" ADD CONSTRAINT "physical_verifications_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT'
    )
  );
});

// ---------------------------------------------------------------------------
// 4. Security & Routing Tests
// ---------------------------------------------------------------------------

test('P11 Security: Unauthenticated GET /api/assets/:id/verifications returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/verifications`
    );
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P11 Security: Unauthenticated POST /api/assets/:id/verifications returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/verifications`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'VERIFIED_MATCH',
          datePrecision: 'DAY',
          verifiedYear: 2026,
          verifiedMonth: 11,
          verifiedDay: 8,
        }),
      }
    );
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P11 Routing: Malformed asset UUID in verification route rejects with 400 Bad Request', async () => {
  const express = (await import('express')).default;
  const { verificationRouter } = await import('../server/routes/verifications.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/assets/:assetId/verifications', verificationRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/not-a-valid-uuid/verifications`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error?.includes('Malformed asset ID'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P11 Security: CSRF token is strictly enforced on authenticated POST /api/assets/:id/verifications', async () => {
  const express = (await import('express')).default;
  const { csrfProtection } = await import('../server/middleware/csrf.ts');
  const { verificationRouter } = await import('../server/routes/verifications.ts');

  const app = express();
  app.use(express.json());
  // Simulate active authenticated admin session
  app.use((req: any, _res, next) => {
    req.session = {
      adminId: '00000000-0000-4000-a000-000000000001',
      username: 'admin',
      csrfToken: 'valid-secret-csrf-token-123456789012',
    };
    next();
  });
  app.use(csrfProtection);
  app.use('/api/assets/:assetId/verifications', verificationRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    // Missing CSRF token -> 403 Forbidden
    const resNoCsrf = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/verifications`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome: 'VERIFIED_MATCH',
          datePrecision: 'DAY',
          verifiedYear: 2026,
          verifiedMonth: 11,
          verifiedDay: 8,
        }),
      }
    );
    assert.equal(resNoCsrf.status, 403);
    const body = await resNoCsrf.json();
    assert.equal(body.error, 'Invalid or missing CSRF token');

    // Wrong CSRF token -> 403 Forbidden
    const resBadCsrf = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/verifications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'attacker-forged-token',
        },
        body: JSON.stringify({
          outcome: 'VERIFIED_MATCH',
          datePrecision: 'DAY',
          verifiedYear: 2026,
          verifiedMonth: 11,
          verifiedDay: 8,
        }),
      }
    );
    assert.equal(resBadCsrf.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// 5. General PATCH Immutability Protection
// ---------------------------------------------------------------------------

test('P11 General PATCH: strictly forbids physical verification fields and history modification', () => {
  const patchAttempts = [
    { lastVerifiedAt: new Date().toISOString() },
    { lastVerifiedYearMonth: '2026-11' },
    { lastVerificationOutcome: 'VERIFIED_MATCH' },
    { verifications: [] },
  ];

  for (const attempt of patchAttempts) {
    const result = validatePatchAssetInput(attempt);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'FORBIDDEN_FIELD');
    assert.ok(result.error.includes('Phase P11'));
  }
});
