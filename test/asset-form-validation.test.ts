import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUuidFormat,
  validateNewAssetForm,
  buildCreateAssetPayload,
} from '../src/utils/assetFormValidation.ts';
import type { NewAssetFormData } from '../src/types/asset.ts';

const baseValidForm: NewAssetFormData = {
  model: 'ThinkPad T14 Gen 4',
  assetNumber: 'AST-2024-001',
  serialNumber: 'PF-49X8291',
  typeId: '123e4567-e89b-12d3-a456-426614174000',
  status: 'SPARE',
  locationId: '223e4567-e89b-12d3-a456-426614174000',
  deviceHealthId: '323e4567-e89b-12d3-a456-426614174000',
  acOwnerId: '423e4567-e89b-12d3-a456-426614174000',
  currentUserId: '523e4567-e89b-12d3-a456-426614174000',
  department: 'Infrastructure & Cloud',
  costCenter: 'CC-9010',
  label: 'Lead Site Reliability Engineer Laptop',
  comment: 'Standard corporate build with TPM 2.0 and full disk encryption.',
};

test('P06 Form Validation: detects valid and invalid UUIDs', () => {
  assert.equal(isValidUuidFormat('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.equal(isValidUuidFormat('invalid-uuid'), false);
  assert.equal(isValidUuidFormat(''), false);
  assert.equal(isValidUuidFormat(null), false);
});

test('P06 Form Validation: requires non-empty model', () => {
  const invalid1 = validateNewAssetForm({ ...baseValidForm, model: '' });
  assert.equal(invalid1.valid, false);
  assert.ok(invalid1.errors.model?.includes('mandatory'));

  const invalid2 = validateNewAssetForm({ ...baseValidForm, model: '   ' });
  assert.equal(invalid2.valid, false);
  assert.ok(invalid2.errors.model?.includes('mandatory'));

  const valid = validateNewAssetForm(baseValidForm);
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.model, undefined);
});

test('P06 Form Validation: validates optional UUID format when specified', () => {
  const invalidTypeId = validateNewAssetForm({
    ...baseValidForm,
    typeId: 'not-a-valid-uuid',
  });
  assert.equal(invalidTypeId.valid, false);
  assert.ok(invalidTypeId.errors.typeId?.includes('Invalid'));

  const invalidOwnerId = validateNewAssetForm({
    ...baseValidForm,
    acOwnerId: 'bad-owner-uuid',
  });
  assert.equal(invalidOwnerId.valid, false);
  assert.ok(invalidOwnerId.errors.acOwnerId?.includes('Invalid'));
});

test('P06 Payload Builder: converts empty strings to null and never fabricates identifiers', () => {
  const emptyOptionalForm: NewAssetFormData = {
    model: '  Dell Precision 3581  ',
    assetNumber: '  ',
    serialNumber: '',
    typeId: '',
    status: 'SPARE',
    locationId: '',
    deviceHealthId: '',
    acOwnerId: '',
    currentUserId: '',
    department: '   ',
    costCenter: '',
    label: '',
    comment: '   ',
  };

  const payload = buildCreateAssetPayload(emptyOptionalForm);

  assert.equal(payload.model, 'Dell Precision 3581');
  assert.equal(payload.assetNumber, null, 'Empty asset number must be null, never "N/A"');
  assert.equal(payload.serialNumber, null, 'Empty serial number must be null, never "N/A"');
  assert.equal(payload.typeId, null);
  assert.equal(payload.locationId, null);
  assert.equal(payload.deviceHealthId, null);
  assert.equal(payload.acOwnerId, null);
  assert.equal(payload.currentUserId, null);
  assert.equal(payload.department, null);
  assert.equal(payload.costCenter, null);
  assert.equal(payload.label, null);
  assert.equal(payload.comment, null);
  assert.equal(payload.legacyNewCostCenter, null);
});

test('P06 Payload Builder: preserves distinct identifiers and assignments when present', () => {
  const payload = buildCreateAssetPayload(baseValidForm);

  assert.equal(payload.model, 'ThinkPad T14 Gen 4');
  assert.equal(payload.assetNumber, 'AST-2024-001');
  assert.equal(payload.serialNumber, 'PF-49X8291');
  assert.equal(payload.acOwnerId, '423e4567-e89b-12d3-a456-426614174000');
  assert.equal(payload.currentUserId, '523e4567-e89b-12d3-a456-426614174000');
  assert.notEqual(payload.acOwnerId, payload.currentUserId, 'AC Owner and Current User are distinct');
});
