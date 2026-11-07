import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_PATCH_FIELDS,
  FORBIDDEN_PATCH_FIELDS,
  validatePatchForm,
  computePatchDelta,
} from '../src/utils/assetPatchValidation.ts';
import type { PatchAssetFormValues, AssetListItem } from '../src/types/asset.ts';
import { validatePatchAssetInput } from '../server/validators/assetValidators.ts';

test('P09-AC02: Exactly the nine general fields are allowlisted for inline editing', () => {
  const expectedAllowlist = [
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

  assert.equal(ALLOWED_PATCH_FIELDS.length, 9);
  for (const field of expectedAllowlist) {
    assert.ok(
      ALLOWED_PATCH_FIELDS.includes(field as any),
      `Field '${field}' must be included in ALLOWED_PATCH_FIELDS`
    );
  }
});

test('P09-AC02: Sensitive ownership, assignment, and verification fields are strictly forbidden', () => {
  const expectedForbidden = [
    'id',
    'acOwnerId',
    'currentUserId',
    'acOwner',
    'currentUser',
    'department',
    'costCenter',
    'legacyNewCostCenter',
    'lastVerifiedAt',
    'lastVerifiedYearMonth',
    'lastVerificationOutcome',
    'verifications',
    'transfers',
    'auditEvents',
    'createdAt',
    'updatedAt',
  ];

  for (const field of expectedForbidden) {
    assert.ok(
      FORBIDDEN_PATCH_FIELDS.includes(field as any),
      `Field '${field}' must be in FORBIDDEN_PATCH_FIELDS`
    );

    // Also test backend validator rejects it
    const validation = validatePatchAssetInput({ [field]: 'unauthorized-value' });
    assert.equal(validation.valid, false, `Backend must reject forbidden field '${field}'`);
    assert.equal(validation.code, 'FORBIDDEN_FIELD');
  }
});

test('P09-AC03: computePatchDelta outputs ONLY changed allowlisted fields and normalizes blanks to null', () => {
  const original: AssetListItem = {
    id: 'a0000000-0000-0000-0000-000000000001',
    model: 'ThinkPad T14 Gen 3',
    assetNumber: 'AST-1001',
    serialNumber: 'PF-239481',
    status: 'IN_USE',
    department: 'Engineering',
    costCenter: 'CC-ENG-101',
    label: 'DEV-MACHINE-01',
    comment: 'Original comment',
    typeId: 'b0000000-0000-0000-0000-000000000001',
    locationId: 'c0000000-0000-0000-0000-000000000001',
    deviceHealthId: 'd0000000-0000-0000-0000-000000000001',
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  // Modify only model and label; clear serialNumber
  const form: PatchAssetFormValues = {
    model: 'ThinkPad T14 Gen 4', // Changed
    assetNumber: 'AST-1001', // Unchanged
    serialNumber: '', // Cleared -> should become null
    typeId: 'b0000000-0000-0000-0000-000000000001', // Unchanged
    locationId: 'c0000000-0000-0000-0000-000000000001', // Unchanged
    deviceHealthId: 'd0000000-0000-0000-0000-000000000001', // Unchanged
    status: 'IN_USE', // Unchanged
    label: 'DEV-MACHINE-02', // Changed
    comment: 'Original comment', // Unchanged
  };

  const deltaResult = computePatchDelta(original, form);

  assert.equal(deltaResult.hasChanges, true);
  assert.deepEqual(deltaResult.changedFields.sort(), ['label', 'model', 'serialNumber'].sort());
  assert.equal(deltaResult.delta.model, 'ThinkPad T14 Gen 4');
  assert.equal(deltaResult.delta.label, 'DEV-MACHINE-02');
  assert.equal(deltaResult.delta.serialNumber, null); // Normalized empty to null
  assert.equal(deltaResult.delta.assetNumber, undefined); // Unchanged field omitted
  assert.equal(deltaResult.delta.status, undefined); // Unchanged field omitted
});

test('P09-AC03: No-Op detection identifies identical inputs without emitting writes', () => {
  const original: AssetListItem = {
    id: 'a0000000-0000-0000-0000-000000000002',
    model: 'MacBook Pro 16',
    assetNumber: 'AST-2002',
    serialNumber: 'C02G1234MD6R',
    status: 'SPARE',
    department: 'Design',
    costCenter: 'CC-DES-201',
    label: null,
    comment: null,
    typeId: null,
    locationId: null,
    deviceHealthId: null,
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const form: PatchAssetFormValues = {
    model: 'MacBook Pro 16',
    assetNumber: 'AST-2002',
    serialNumber: 'C02G1234MD6R',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
    status: 'SPARE',
    label: '',
    comment: '',
  };

  const deltaResult = computePatchDelta(original, form);

  assert.equal(deltaResult.hasChanges, false);
  assert.equal(deltaResult.changedFields.length, 0);
  assert.deepEqual(deltaResult.delta, {});
});

test('P09-AC05: Client-side validation requires model and valid status', () => {
  // Empty model
  const invalidModelForm: PatchAssetFormValues = {
    model: '   ',
    assetNumber: '',
    serialNumber: '',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
    status: 'IN_USE',
    label: '',
    comment: '',
  };
  const res1 = validatePatchForm(invalidModelForm);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.model);

  // Invalid UUID in typeId
  const invalidUuidForm: PatchAssetFormValues = {
    model: 'Valid Model',
    assetNumber: '',
    serialNumber: '',
    typeId: 'not-a-valid-uuid',
    locationId: '',
    deviceHealthId: '',
    status: 'IN_USE',
    label: '',
    comment: '',
  };
  const res2 = validatePatchForm(invalidUuidForm);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.typeId);

  // Valid complete form
  const validForm: PatchAssetFormValues = {
    model: 'Dell Precision 3660',
    assetNumber: 'AST-3003',
    serialNumber: 'SN-998877',
    typeId: 'b0000000-0000-4000-8000-000000000001',
    locationId: 'c0000000-0000-4000-8000-000000000001',
    deviceHealthId: 'd0000000-0000-4000-8000-000000000001',
    status: 'IN_USE',
    label: 'WORKSTATION-01',
    comment: 'Assigned to ML training',
  };
  const res3 = validatePatchForm(validForm);
  assert.equal(res3.valid, true);
  assert.deepEqual(res3.errors, {});
});

test('P09-AC05: Backend validator enforces UUID and allowlist rules on PATCH payload', () => {
  // Body with invalid UUID typeId
  const validation1 = validatePatchAssetInput({
    model: 'Valid Model',
    typeId: 'invalid-uuid-string',
  });
  assert.equal(validation1.valid, false);
  assert.equal(validation1.field, 'typeId');

  // Body with no allowed fields
  const validation2 = validatePatchAssetInput({});
  assert.equal(validation2.valid, false);
  assert.equal(validation2.code, 'MISSING_REQUIRED');

  // Valid partial PATCH body
  const validation3 = validatePatchAssetInput({
    model: 'New Model Name',
    status: 'SPARE',
  });
  assert.equal(validation3.valid, true);
  assert.equal(validation3.data.model, 'New Model Name');
  assert.equal(validation3.data.status, 'SPARE');
});
