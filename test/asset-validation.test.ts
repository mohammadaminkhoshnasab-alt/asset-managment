import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidUuid,
  validateCreateAssetInput,
  validatePatchAssetInput,
} from '../server/validators/assetValidators.ts';
import { AssetStatus } from '@prisma/client';

test('P04 Validation: isValidUuid detects valid and invalid RFC 4122 UUIDs', () => {
  assert.equal(isValidUuid('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.equal(isValidUuid('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'), true);
  assert.equal(isValidUuid('not-a-uuid'), false);
  assert.equal(isValidUuid('12345'), false);
  assert.equal(isValidUuid(null), false);
  assert.equal(isValidUuid(undefined), false);
});

test('P04 Validation (Create): requires non-empty model', () => {
  const missingModel = validateCreateAssetInput({});
  assert.equal(missingModel.valid, false);
  assert.equal(missingModel.field, 'model');

  const emptyModel = validateCreateAssetInput({ model: '   ' });
  assert.equal(emptyModel.valid, false);
  assert.equal(emptyModel.field, 'model');

  const validModel = validateCreateAssetInput({ model: 'ThinkPad T14 Gen 4' });
  assert.equal(validModel.valid, true);
  if (validModel.valid) {
    assert.equal(validModel.data.model, 'ThinkPad T14 Gen 4');
    assert.equal(validModel.data.status, AssetStatus.SPARE); // Default status
  }
});

test('P04 Validation (Create): normalizes empty identifier strings to NULL', () => {
  const result = validateCreateAssetInput({
    model: 'Dell Latitude 5540',
    assetNumber: '   ',
    serialNumber: '',
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.assetNumber, null);
    assert.equal(result.data.serialNumber, null);
  }
});

test('P04 Validation (Create): stores non-empty identifiers independently', () => {
  const result = validateCreateAssetInput({
    model: 'Dell Latitude 5540',
    assetNumber: 'AST-1001',
    serialNumber: 'SN-998877',
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.assetNumber, 'AST-1001');
    assert.equal(result.data.serialNumber, 'SN-998877');
  }
});

test('P04 Validation (Create): rejects client-specified immutable ID', () => {
  const result = validateCreateAssetInput({
    id: '123e4567-e89b-12d3-a456-426614174000',
    model: 'MacBook Pro 16',
  });

  assert.equal(result.valid, false);
  assert.equal(result.field, 'id');
  assert.ok(result.error?.includes('immutable'));
});

test('P04 Validation (Create): rejects physical verification fields on create', () => {
  const result = validateCreateAssetInput({
    model: 'MacBook Pro 16',
    lastVerifiedAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('verification'));
});

test('P04 Validation (Patch): strictly rejects attempt to modify immutable ID', () => {
  const result = validatePatchAssetInput({
    id: '123e4567-e89b-12d3-a456-426614174000',
  });

  assert.equal(result.valid, false);
  assert.equal(result.field, 'id');
  assert.ok(result.error?.includes('immutable'));
});

test('P04 Validation (Patch): strictly rejects reserved transfer/assignment fields (P10)', () => {
  const reservedFields = ['acOwnerId', 'currentUserId', 'department', 'costCenter', 'eformNumber'];

  for (const field of reservedFields) {
    const result = validatePatchAssetInput({ [field]: 'some-value' });
    assert.equal(result.valid, false, `Field ${field} must be rejected`);
    assert.equal(result.field, field);
    assert.ok(result.error?.toLowerCase().includes('transfer'));
  }
});

test('P04 Validation (Patch): strictly rejects reserved verification fields (P11)', () => {
  const result = validatePatchAssetInput({
    lastVerifiedAt: new Date().toISOString(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.field, 'lastVerifiedAt');
  assert.ok(result.error?.includes('verification'));
});

test('P04 Validation (Patch): rejects unknown fields', () => {
  const result = validatePatchAssetInput({
    customInventedField: 'hello',
  });

  assert.equal(result.valid, false);
  assert.equal(result.field, 'customInventedField');
  assert.ok(result.error?.includes('Unknown or unsupported field'));
});

test('P04 Validation (Patch): accepts safe general fields and normalizes empty strings to null', () => {
  const result = validatePatchAssetInput({
    model: 'Updated ThinkPad T14s',
    assetNumber: '',
    serialNumber: 'SN-NEW-12345',
    status: AssetStatus.IN_USE,
    label: 'Finance Lead Laptop',
    comment: 'Refurbished motherboard replaced',
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.model, 'Updated ThinkPad T14s');
    assert.equal(result.data.assetNumber, null);
    assert.equal(result.data.serialNumber, 'SN-NEW-12345');
    assert.equal(result.data.status, AssetStatus.IN_USE);
    assert.equal(result.data.label, 'Finance Lead Laptop');
    assert.equal(result.data.comment, 'Refurbished motherboard replaced');
  }
});
