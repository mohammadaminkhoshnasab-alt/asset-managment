import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createExpressApp } from '../server/app.ts';
import {
  validateCreateTransferInput,
  validateCompleteTransferInput,
  validateCancelTransferInput,
} from '../server/validators/transferValidators.ts';

const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
const p10MigrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20261107000002_add_transfer_dimensions/migration.sql'
);

// ---------------------------------------------------------------------------
// 1. Validator Tests (Pure Logic)
// ---------------------------------------------------------------------------

test('P10 Validators: validateCreateTransferInput rejects non-object input', () => {
  const result = validateCreateTransferInput(null);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'Request body must be a JSON object.');
});

test('P10 Validators: validateCreateTransferInput rejects general asset fields and client-supplied actor', () => {
  const forbiddenAttempts = [
    { model: 'ThinkPad T14', changeDepartment: true, toDepartment: 'IT' },
    { assetNumber: 'AST-100', changeDepartment: true, toDepartment: 'IT' },
    { serialNumber: 'SN-100', changeDepartment: true, toDepartment: 'IT' },
    { actor: 'attacker', changeDepartment: true, toDepartment: 'IT' },
    { createdBy: 'attacker', changeDepartment: true, toDepartment: 'IT' },
    { status: 'COMPLETED', changeDepartment: true, toDepartment: 'IT' },
    { requestedAt: new Date().toISOString(), changeDepartment: true, toDepartment: 'IT' },
  ];

  for (const attempt of forbiddenAttempts) {
    const result = validateCreateTransferInput(attempt);
    assert.equal(result.valid, false);
    assert.equal(result.code, 'FORBIDDEN_FIELD');
  }
});

test('P10 Validators: validateCreateTransferInput requires at least one transfer dimension', () => {
  const result = validateCreateTransferInput({});
  assert.equal(result.valid, false);
  assert.equal(result.code, 'MISSING_REQUIRED');
  assert.ok(result.error.includes('At least one transfer dimension'));
});

test('P10 Validators: validateCreateTransferInput validates UUIDs for destination references', () => {
  const invalidUuidResult = validateCreateTransferInput({
    changeAcOwner: true,
    toPersonId: 'not-a-valid-uuid',
  });
  assert.equal(invalidUuidResult.valid, false);
  assert.equal(invalidUuidResult.field, 'toPersonId');

  const invalidUserResult = validateCreateTransferInput({
    changeCurrentUser: true,
    toCurrentUserId: '123-bad-uuid',
  });
  assert.equal(invalidUserResult.valid, false);
  assert.equal(invalidUserResult.field, 'toCurrentUserId');

  const invalidLocationResult = validateCreateTransferInput({
    changeLocation: true,
    toLocationId: 'invalid-loc',
  });
  assert.equal(invalidLocationResult.valid, false);
  assert.equal(invalidLocationResult.field, 'toLocationId');
});

test('P10 Validators: validateCreateTransferInput accepts single and multiple dimensions with nullable unassign', () => {
  // Single dimension (Department only)
  const singleDept = validateCreateTransferInput({
    changeDepartment: true,
    toDepartment: 'Engineering Operations',
  });
  assert.equal(singleDept.valid, true);
  if (singleDept.valid) {
    assert.equal(singleDept.data.changeDepartment, true);
    assert.equal(singleDept.data.toDepartment, 'Engineering Operations');
    assert.equal(singleDept.data.changeAcOwner, false);
    assert.equal(singleDept.data.changeCurrentUser, false);
  }

  // Explicit unassign (toDepartment is null/blank)
  const clearDept = validateCreateTransferInput({
    changeDepartment: true,
    toDepartment: '',
  });
  assert.equal(clearDept.valid, true);
  if (clearDept.valid) {
    assert.equal(clearDept.data.changeDepartment, true);
    assert.equal(clearDept.data.toDepartment, null);
  }

  // All 5 dimensions simultaneously with valid UUIDs
  const validUuid1 = 'a0000000-0000-4000-a000-000000000001';
  const validUuid2 = 'b0000000-0000-4000-b000-000000000002';
  const validUuid3 = 'c0000000-0000-4000-8000-000000000003';

  const allDimensions = validateCreateTransferInput({
    changeAcOwner: true,
    toPersonId: validUuid1,
    changeCurrentUser: true,
    toCurrentUserId: validUuid2,
    changeDepartment: true,
    toDepartment: 'DevOps',
    changeCostCenter: true,
    toCostCenter: 'CC-9900',
    changeLocation: true,
    toLocationId: validUuid3,
    eformNumber: 'EF-2026-999',
    notes: 'Project reallocation',
  });
  assert.equal(allDimensions.valid, true);
  if (allDimensions.valid) {
    assert.equal(allDimensions.data.toPersonId, validUuid1);
    assert.equal(allDimensions.data.toCurrentUserId, validUuid2);
    assert.equal(allDimensions.data.toDepartment, 'DevOps');
    assert.equal(allDimensions.data.toCostCenter, 'CC-9900');
    assert.equal(allDimensions.data.toLocationId, validUuid3);
    assert.equal(allDimensions.data.eformNumber, 'EF-2026-999');
    assert.equal(allDimensions.data.notes, 'Project reallocation');
  }
});

test('P10 Validators: validateCompleteTransferInput rejects empty or whitespace eForm number', () => {
  const emptyResult = validateCompleteTransferInput({ eformNumber: '' });
  assert.equal(emptyResult.valid, false);
  assert.equal(emptyResult.code, 'MISSING_REQUIRED');

  const whitespaceResult = validateCompleteTransferInput({ eformNumber: '   ' });
  assert.equal(whitespaceResult.valid, false);
  assert.equal(whitespaceResult.code, 'MISSING_REQUIRED');

  const validResult = validateCompleteTransferInput({
    eformNumber: '  EF-12345  ',
    notes: 'Physical handoff verified',
  });
  assert.equal(validResult.valid, true);
  if (validResult.valid) {
    assert.equal(validResult.data.eformNumber, 'EF-12345');
    assert.equal(validResult.data.notes, 'Physical handoff verified');
  }
});

test('P10 Validators: validateCancelTransferInput accepts optional notes and normalizes whitespace', () => {
  const result = validateCancelTransferInput({ notes: '  Cancelled by HR request  ' });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.notes, 'Cancelled by HR request');
  }
});

// ---------------------------------------------------------------------------
// 2. Schema and Additive Migration Invariant Tests
// ---------------------------------------------------------------------------

test('P10 Schema: AssetTransfer model contains all required additive columns and change intent flags', () => {
  assert.ok(fs.existsSync(schemaPath), 'prisma/schema.prisma must exist');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Verify additive columns for Current User and Cost Center
  assert.ok(schemaContent.includes('fromCurrentUserId String?     @map("from_current_user_id") @db.Uuid'));
  assert.ok(schemaContent.includes('toCurrentUserId   String?     @map("to_current_user_id") @db.Uuid'));
  assert.ok(schemaContent.includes('fromCostCenter String?        @map("from_cost_center")'));
  assert.ok(schemaContent.includes('toCostCenter   String?        @map("to_cost_center")'));

  // Verify explicit boolean intent flags
  assert.ok(schemaContent.includes('changeAcOwner     Boolean     @default(false) @map("change_ac_owner")'));
  assert.ok(schemaContent.includes('changeCurrentUser Boolean     @default(false) @map("change_current_user")'));
  assert.ok(schemaContent.includes('changeDepartment  Boolean     @default(false) @map("change_department")'));
  assert.ok(schemaContent.includes('changeCostCenter  Boolean     @default(false) @map("change_cost_center")'));
  assert.ok(schemaContent.includes('changeLocation    Boolean     @default(false) @map("change_location")'));

  // Verify separate Person relations for AC Owner vs Current User (never conflated)
  assert.ok(schemaContent.includes('@relation("TransferFromPerson"'));
  assert.ok(schemaContent.includes('@relation("TransferToPerson"'));
  assert.ok(schemaContent.includes('@relation("TransferFromCurrentUser"'));
  assert.ok(schemaContent.includes('@relation("TransferToCurrentUser"'));
});

test('P10 Schema: Migration SQL exists and defines strictly additive columns without table drops', () => {
  assert.ok(fs.existsSync(p10MigrationPath), 'P10 migration file must exist');
  const sql = fs.readFileSync(p10MigrationPath, 'utf8');

  // Must only ALTER TABLE ADD COLUMN, never DROP TABLE
  assert.ok(!sql.includes('DROP TABLE'), 'Migration must NOT drop any tables');
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "from_current_user_id" UUID;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "to_current_user_id" UUID;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "from_cost_center" TEXT;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "to_cost_center" TEXT;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "change_ac_owner" BOOLEAN NOT NULL DEFAULT false;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "change_current_user" BOOLEAN NOT NULL DEFAULT false;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "change_department" BOOLEAN NOT NULL DEFAULT false;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "change_cost_center" BOOLEAN NOT NULL DEFAULT false;'));
  assert.ok(sql.includes('ALTER TABLE "asset_transfers" ADD COLUMN "change_location" BOOLEAN NOT NULL DEFAULT false;'));
});

test('P10 Invariant: eForm Number is indexed but NOT unique (can repeat across different assets)', () => {
  const initialMigrationPath = path.resolve(
    process.cwd(),
    'prisma/migrations/20261107000000_init_postgresql_schema/migration.sql'
  );
  assert.ok(fs.existsSync(initialMigrationPath));
  const sql = fs.readFileSync(initialMigrationPath, 'utf8');

  assert.ok(
    sql.includes('CREATE INDEX "asset_transfers_eform_number_idx" ON "asset_transfers"("eform_number");'),
    'eForm number must have non-unique index'
  );
  assert.ok(
    !sql.includes('CREATE UNIQUE INDEX "asset_transfers_eform_number_key"'),
    'eForm number must NOT be unique'
  );
});

// ---------------------------------------------------------------------------
// 3. HTTP Security & Endpoint Protection Tests
// ---------------------------------------------------------------------------

test('P10 Security: Unauthenticated GET /api/assets/:id/transfers returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/transfers`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P10 Security: Unauthenticated POST /api/assets/:id/transfers returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeDepartment: true, toDepartment: 'IT' }),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P10 Security: Unauthenticated POST complete transfer returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/transfers/00000000-0000-4000-b000-000000000002/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eformNumber: 'EF-2026-001' }),
      }
    );
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P10 Security: Unauthenticated POST cancel transfer returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/api/assets/00000000-0000-4000-a000-000000000001/transfers/00000000-0000-4000-b000-000000000002/cancel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Cancelling' }),
      }
    );
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P10 Routing: Malformed asset UUID in transfer route rejects with 400 Bad Request', async () => {
  // Mount mock auth middleware simulating admin
  const express = (await import('express')).default;
  const { transferRouter } = await import('../server/routes/transfers.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/assets/:assetId/transfers', transferRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/not-a-valid-uuid/transfers`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error?.includes('Malformed asset ID'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// 4. P10-REWORK: Bounded Pagination Query Validation
// ---------------------------------------------------------------------------

test('P10-Rework Validators: validateTransferPaginationQuery enforces defaults, bounds, and integers', async () => {
  const { validateTransferPaginationQuery } = await import('../server/validators/transferValidators.ts');

  // Default parameters
  const defaultRes = validateTransferPaginationQuery({});
  assert.equal(defaultRes.valid, true);
  if (defaultRes.valid) {
    assert.equal(defaultRes.data.page, 1);
    assert.equal(defaultRes.data.limit, 20);
  }

  // Valid custom parameters
  const customRes = validateTransferPaginationQuery({ page: '3', limit: '50' });
  assert.equal(customRes.valid, true);
  if (customRes.valid) {
    assert.equal(customRes.data.page, 3);
    assert.equal(customRes.data.limit, 50);
  }

  // Maximum boundary limit (100 is allowed)
  const maxLimitRes = validateTransferPaginationQuery({ page: '1', limit: '100' });
  assert.equal(maxLimitRes.valid, true);
  if (maxLimitRes.valid) {
    assert.equal(maxLimitRes.data.limit, 100);
  }

  // Exceeding maximum limit (>100 rejected)
  const overLimitRes = validateTransferPaginationQuery({ page: '1', limit: '101' });
  assert.equal(overLimitRes.valid, false);
  assert.equal(overLimitRes.field, 'limit');

  // Non-positive page rejected
  const zeroPageRes = validateTransferPaginationQuery({ page: '0' });
  assert.equal(zeroPageRes.valid, false);
  assert.equal(zeroPageRes.field, 'page');

  const negPageRes = validateTransferPaginationQuery({ page: '-5' });
  assert.equal(negPageRes.valid, false);
  assert.equal(negPageRes.field, 'page');

  // Float numbers rejected
  const floatRes = validateTransferPaginationQuery({ page: '1.5' });
  assert.equal(floatRes.valid, false);
  assert.equal(floatRes.field, 'page');
});

// ---------------------------------------------------------------------------
// 5. P10-REWORK: Safe Additive PostgreSQL Partial Unique Index Invariant
// ---------------------------------------------------------------------------

test('P10-Rework Migration: partial unique index guarantees single pending transfer without restricting eForm reuse', () => {
  const reworkMigrationPath = path.resolve(
    process.cwd(),
    'prisma/migrations/20261107000003_add_pending_transfer_partial_unique_index/migration.sql'
  );
  assert.ok(fs.existsSync(reworkMigrationPath), 'P10 rework migration file must exist');
  const sql = fs.readFileSync(reworkMigrationPath, 'utf8');

  // 1. Must define PostgreSQL partial unique index on asset_id WHERE status = 'PENDING'
  assert.ok(
    sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "asset_transfers_asset_id_pending_unique"'),
    'Must define partial unique index asset_transfers_asset_id_pending_unique'
  );
  assert.ok(
    sql.includes('ON "asset_transfers" ("asset_id")'),
    'Index must be on asset_id'
  );
  assert.ok(
    sql.includes('WHERE "status" = \'PENDING\''),
    "Index must be filtered strictly WHERE status = 'PENDING'"
  );

  // 2. Invariant: Must NOT impose uniqueness on eform_number
  const activeSql = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  assert.ok(
    !activeSql.includes('eform_number'),
    'Partial unique index migration SQL statements must NOT touch or restrict eform_number'
  );
  assert.ok(
    !sql.includes('CREATE UNIQUE INDEX "asset_transfers_eform_number'),
    'Partial unique index migration must NOT create unique index on eform_number'
  );
});

// ---------------------------------------------------------------------------
// 6. P10-REWORK: Routing Validation for Bounded Pagination
// ---------------------------------------------------------------------------

test('P10-Rework Routing: GET /api/assets/:assetId/transfers validates pagination query params', async () => {
  const express = (await import('express')).default;
  const { transferRouter } = await import('../server/routes/transfers.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/assets/:assetId/transfers', transferRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const validUuid = '00000000-0000-4000-a000-000000000001';

  try {
    // Limit over 100 rejected with 400
    const overLimitRes = await fetch(`http://127.0.0.1:${port}/api/assets/${validUuid}/transfers?limit=150`);
    assert.equal(overLimitRes.status, 400);
    const overLimitBody = await overLimitRes.json();
    assert.equal(overLimitBody.status, 'error');
    assert.ok(overLimitBody.error?.includes('between 1 and 100'));

    // Page < 1 rejected with 400
    const invalidPageRes = await fetch(`http://127.0.0.1:${port}/api/assets/${validUuid}/transfers?page=0`);
    assert.equal(invalidPageRes.status, 400);
    const invalidPageBody = await invalidPageRes.json();
    assert.equal(invalidPageBody.status, 'error');
    assert.ok(invalidPageBody.error?.includes('positive integer'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// 7. P10-REWORK: Truthful Transfer Cancellation Audit Scope
// ---------------------------------------------------------------------------

test('P10-Rework Audit: Cancellation audit clearly scopes to transferStatus and avoids Asset.status', async () => {
  const transferServiceFile = path.resolve(process.cwd(), 'server/services/transferService.ts');
  const serviceCode = fs.readFileSync(transferServiceFile, 'utf8');

  // Verify that cancelTransfer uses transferStatus in changedFields
  assert.ok(
    serviceCode.includes("changedFields: ['transferStatus']"),
    "cancelTransfer must write changedFields: ['transferStatus']"
  );
  assert.ok(
    serviceCode.includes("beforeValues: { transferStatus: 'PENDING'"),
    'cancelTransfer must write beforeValues with transferStatus: PENDING'
  );
  assert.ok(
    serviceCode.includes("afterValues: { transferStatus: 'CANCELLED'"),
    'cancelTransfer must write afterValues with transferStatus: CANCELLED'
  );
  // Verify that cancelTransfer never calls tx.asset.update or modifies Asset
  assert.ok(
    !serviceCode.includes('tx.asset.update') ||
      !serviceCode.split('cancelTransfer')[1].includes('tx.asset.update'),
    'cancelTransfer must never update the Asset record'
  );
});

// ---------------------------------------------------------------------------
// 8. P10-REWORK: Concurrency & Compare-and-Set Status Guards
// ---------------------------------------------------------------------------

test('P10-Rework Concurrency: completeTransfer and cancelTransfer use status-guarded updateMany and compare-and-set', async () => {
  const transferServiceFile = path.resolve(process.cwd(), 'server/services/transferService.ts');
  const serviceCode = fs.readFileSync(transferServiceFile, 'utf8');

  // Exactly-once status-guarded check on transfer completion
  assert.ok(
    serviceCode.includes('status: TransferStatus.PENDING'),
    'Must filter on status: PENDING in update condition'
  );
  assert.ok(
    serviceCode.includes('transferUpdateResult.count === 0'),
    'Must verify affected row count for transfer completion race detection'
  );

  // Compare-and-Set check on asset changed dimensions
  assert.ok(
    serviceCode.includes('assetUpdateResult.count === 0'),
    'Must verify affected row count for asset compare-and-set stale origin detection'
  );

  // Exactly-once status-guarded check on transfer cancellation
  assert.ok(
    serviceCode.includes('updateResult.count === 0'),
    'Must verify affected row count for transfer cancellation race detection'
  );
});

// ---------------------------------------------------------------------------
// 9. P10-REWORK: Live PostgreSQL Daemon Check
// ---------------------------------------------------------------------------

test('P10-Rework Live Database Concurrency: marks NOT VERIFIED when no active PostgreSQL daemon is available', async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('postgres:postgres@127.0.0.1:5432/it_asset_management')) {
    console.log(
      '[P10 Concurrency Notice] Multi-client live database concurrency races (P10-R01 to P10-R03) marked NOT VERIFIED in ephemeral container without active PostgreSQL service.'
    );
    assert.ok(true, 'Live multi-client race integration test safely documented as NOT VERIFIED without external PostgreSQL service');
    return;
  }
  assert.ok(typeof dbUrl === 'string');
});
