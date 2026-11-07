import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { ASSET_LIST_RELATIONS } from '../server/services/assetService.ts';

test('P08 Schema Regression: ASSET_LIST_RELATIONS only selects columns that exist in schema.prisma', () => {
  const models = Prisma.dmmf.datamodel.models;

  const getModelFields = (modelName: string): Set<string> => {
    const model = models.find((m) => m.name === modelName);
    assert.ok(model, `Prisma model '${modelName}' must exist in schema.prisma`);
    return new Set(model.fields.map((f) => f.name));
  };

  const assetTypeFields = getModelFields('AssetType');
  const locationFields = getModelFields('Location');
  const deviceHealthFields = getModelFields('DeviceHealth');
  const personFields = getModelFields('Person');

  // 1. AssetType checks
  assert.equal(
    assetTypeFields.has('code'),
    false,
    "Schema check: 'code' column does not exist on AssetType"
  );
  const typeSelect = (ASSET_LIST_RELATIONS.type as any)?.select || {};
  assert.equal(
    'code' in typeSelect,
    false,
    "ASSET_LIST_RELATIONS.type must not select unsupported 'code' column"
  );
  for (const field of Object.keys(typeSelect)) {
    assert.equal(
      assetTypeFields.has(field),
      true,
      `Selected field '${field}' on type relation must exist in AssetType schema`
    );
  }

  // 2. Location checks
  assert.equal(
    locationFields.has('code'),
    false,
    "Schema check: 'code' column does not exist on Location"
  );
  const locationSelect = (ASSET_LIST_RELATIONS.location as any)?.select || {};
  assert.equal(
    'code' in locationSelect,
    false,
    "ASSET_LIST_RELATIONS.location must not select unsupported 'code' column"
  );
  for (const field of Object.keys(locationSelect)) {
    assert.equal(
      locationFields.has(field),
      true,
      `Selected field '${field}' on location relation must exist in Location schema`
    );
  }

  // 3. DeviceHealth checks
  const healthSelect = (ASSET_LIST_RELATIONS.deviceHealth as any)?.select || {};
  for (const field of Object.keys(healthSelect)) {
    assert.equal(
      deviceHealthFields.has(field),
      true,
      `Selected field '${field}' on deviceHealth relation must exist in DeviceHealth schema`
    );
  }

  // 4. Person (acOwner & currentUser) checks
  const acOwnerSelect = (ASSET_LIST_RELATIONS.acOwner as any)?.select || {};
  for (const field of Object.keys(acOwnerSelect)) {
    assert.equal(
      personFields.has(field),
      true,
      `Selected field '${field}' on acOwner relation must exist in Person schema`
    );
  }

  const currentUserSelect = (ASSET_LIST_RELATIONS.currentUser as any)?.select || {};
  for (const field of Object.keys(currentUserSelect)) {
    assert.equal(
      personFields.has(field),
      true,
      `Selected field '${field}' on currentUser relation must exist in Person schema`
    );
  }

  // 5. Exclude sensitive credentials or authentication records
  assert.equal('passwordHash' in acOwnerSelect, false);
  assert.equal('passwordHash' in currentUserSelect, false);
  assert.equal('salt' in acOwnerSelect, false);
  assert.equal('salt' in currentUserSelect, false);
});
