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
