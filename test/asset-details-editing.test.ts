import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_PATCH_FIELDS,
  FORBIDDEN_PATCH_FIELDS,
  validatePatchForm,
  computePatchDelta,
} from '../src/utils/assetPatchValidation.ts';
import type { AssetDetails, PatchAssetFormValues } from '../src/types/asset.ts';

const mockOriginalAsset: AssetDetails = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  model: 'ThinkPad T14 Gen 4',
  assetNumber: 'AST-2024-001',
  serialNumber: 'PF-49X8291',
  typeId: '223e4567-e89b-12d3-a456-426614174000',
  locationId: '323e4567-e89b-12d3-a456-426614174000',
  deviceHealthId: '423e4567-e89b-12d3-a456-426614174000',
  status: 'SPARE',
  label: 'Lead SRE Laptop',
  comment: 'Initial issue with charger and peripheral kit.',
  acOwnerId: '523e4567-e89b-12d3-a456-426614174000',
  currentUserId: '623e4567-e89b-12d3-a456-426614174000',
  department: 'Infrastructure',
  costCenter: 'CC-9010',
  legacyNewCostCenter: null,
  createdAt: '2026-11-07T12:00:00.000Z',
  updatedAt: '2026-11-07T12:00:00.000Z',
  type: { id: '223e4567-e89b-12d3-a456-426614174000', name: 'Laptop', isActive: true },
  location: { id: '323e4567-e89b-12d3-a456-426614174000', name: 'Server Room', isActive: true },
  deviceHealth: { id: '423e4567-e89b-12d3-a456-426614174000', name: 'Good', isActive: true },
  acOwner: { id: '523e4567-e89b-12d3-a456-426614174000', fullName: 'Alice Smith', personalCode: 'EMP-100', isActive: true },
  currentUser: { id: '623e4567-e89b-12d3-a456-426614174000', fullName: 'Bob Jones', username: 'bjones', isActive: true },
};

const baseMatchingForm: PatchAssetFormValues = {
  model: 'ThinkPad T14 Gen 4',
  assetNumber: 'AST-2024-001',
  serialNumber: 'PF-49X8291',
  typeId: '223e4567-e89b-12d3-a456-426614174000',
  locationId: '323e4567-e89b-12d3-a456-426614174000',
  deviceHealthId: '423e4567-e89b-12d3-a456-426614174000',
  status: 'SPARE',
  label: 'Lead SRE Laptop',
  comment: 'Initial issue with charger and peripheral kit.',
};

test('P07 Allowlist: defines exactly nine general fields and forbids transfer/assignment/audit fields', () => {
  assert.equal(ALLOWED_PATCH_FIELDS.length, 9);
  const expected = [
    'model',
    'assetNumber',
    'serialNumber',
    'typeId',
    'locationId',
    'deviceHealthId',
    'status',
    'label',
    'comment',
  ];
  assert.deepEqual([...ALLOWED_PATCH_FIELDS].sort(), expected.sort());

  for (const forbidden of ['id', 'acOwnerId', 'currentUserId', 'department', 'costCenter', 'verifications']) {
    assert.ok(
      FORBIDDEN_PATCH_FIELDS.includes(forbidden as any),
      `Field ${forbidden} must be forbidden in general PATCH`
    );
  }
});

test('P07 Validation: validatePatchForm requires model and validates UUID formats', () => {
  const invalidModel = validatePatchForm({ ...baseMatchingForm, model: '   ' });
  assert.equal(invalidModel.valid, false);
  assert.ok(invalidModel.errors.model?.includes('mandatory'));

  const invalidUuid = validatePatchForm({ ...baseMatchingForm, locationId: 'bad-uuid' });
  assert.equal(invalidUuid.valid, false);
  assert.ok(invalidUuid.errors.locationId?.includes('Invalid Location'));

  const valid = validatePatchForm(baseMatchingForm);
  assert.equal(valid.valid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

test('P07 Delta Computation: detects no-op when no fields were modified', () => {
  const result = computePatchDelta(mockOriginalAsset, baseMatchingForm);
  assert.equal(result.hasChanges, false);
  assert.equal(result.changedFields.length, 0);
  assert.deepEqual(result.delta, {});
});

test('P07 Delta Computation: extracts only modified allowlisted fields and normalizes empty string to null', () => {
  const editedForm: PatchAssetFormValues = {
    ...baseMatchingForm,
    model: 'ThinkPad T14s Gen 4 (Upgraded)',
    assetNumber: '', // User cleared asset number -> must normalize to null
    status: 'IN_USE',
  };

  const result = computePatchDelta(mockOriginalAsset, editedForm);
  assert.equal(result.hasChanges, true);
  assert.equal(result.changedFields.length, 3);
  assert.ok(result.changedFields.includes('model'));
  assert.ok(result.changedFields.includes('assetNumber'));
  assert.ok(result.changedFields.includes('status'));

  assert.equal(result.delta.model, 'ThinkPad T14s Gen 4 (Upgraded)');
  assert.equal(result.delta.assetNumber, null);
  assert.equal(result.delta.status, 'IN_USE');

  // Must NOT include untouched fields
  assert.equal(result.delta.serialNumber, undefined);
  assert.equal(result.delta.typeId, undefined);
  assert.equal(result.delta.comment, undefined);
});

test('P07 Delta Computation: treats whitespace-only and null consistently as null', () => {
  const assetWithNulls: AssetDetails = {
    ...mockOriginalAsset,
    label: null,
    comment: null,
  };

  const formWithEmptyStrings: PatchAssetFormValues = {
    ...baseMatchingForm,
    label: '   ',
    comment: '',
  };

  const result = computePatchDelta(assetWithNulls, formWithEmptyStrings);
  // Both are effectively null -> no change
  assert.equal(result.changedFields.includes('label'), false);
  assert.equal(result.changedFields.includes('comment'), false);
});

test('P07 Route Matching: correctly identifies asset detail UUIDs vs general routes', () => {
  const uuidRegex = /^\/assets\/([0-9a-fA-F-]{36})$/;
  assert.ok(uuidRegex.test('/assets/123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(uuidRegex.test('/assets/a0000000-0000-0000-0000-000000000001'));
  // Must NOT match new asset or general routes
  assert.equal(uuidRegex.test('/assets/new'), false);
  assert.equal(uuidRegex.test('/assets'), false);
  assert.equal(uuidRegex.test('/assets/123-invalid'), false);
});
