import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateListAssetsQuery,
  buildPrismaWhereClause,
  buildPrismaOrderBy,
  ALLOWED_SORT_FIELDS,
} from '../server/validators/assetListValidators.ts';

test('P08 Validation: provides default pagination, sorting, and empty search/filter', () => {
  const result = validateListAssetsQuery({});
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.page, 1);
    assert.equal(result.data.pageSize, 25);
    assert.equal(result.data.sortBy, 'updatedAt');
    assert.equal(result.data.sortOrder, 'desc');
    assert.equal(result.data.q, undefined);
    assert.equal(result.data.filters, undefined);
  }
});

test('P08 Validation: enforces pagination bounds and integers', () => {
  // Reject page 0
  const zeroPage = validateListAssetsQuery({ page: '0' });
  assert.equal(zeroPage.valid, false);
  assert.match((zeroPage as any).error, /positive integer/);

  // Reject negative page
  const negPage = validateListAssetsQuery({ page: '-5' });
  assert.equal(negPage.valid, false);

  // Reject non-integer page
  const floatPage = validateListAssetsQuery({ page: '1.5' });
  assert.equal(floatPage.valid, false);

  // Reject pageSize < 1
  const zeroPageSize = validateListAssetsQuery({ pageSize: '0' });
  assert.equal(zeroPageSize.valid, false);
  assert.match((zeroPageSize as any).error, /between 1 and 100/);

  // Reject pageSize > 100
  const largePageSize = validateListAssetsQuery({ pageSize: '101' });
  assert.equal(largePageSize.valid, false);

  // Accept valid custom page and pageSize
  const validPage = validateListAssetsQuery({ page: '4', pageSize: '50' });
  assert.equal(validPage.valid, true);
  if (validPage.valid) {
    assert.equal(validPage.data.page, 4);
    assert.equal(validPage.data.pageSize, 50);
  }
});

test('P08 Validation: enforces sort allowlist and directions', () => {
  for (const field of ALLOWED_SORT_FIELDS) {
    const res = validateListAssetsQuery({ sortBy: field, sortOrder: 'asc' });
    assert.equal(res.valid, true, `Field '${field}' should be accepted as sortBy`);
    if (res.valid) {
      assert.equal(res.data.sortBy, field);
      assert.equal(res.data.sortOrder, 'asc');
    }
  }

  // Reject unauthorized sort field
  const invalidSort = validateListAssetsQuery({ sortBy: 'passwordHash' });
  assert.equal(invalidSort.valid, false);
  assert.match((invalidSort as any).error, /must be one of/);

  // Reject invalid sortOrder
  const invalidOrder = validateListAssetsQuery({ sortOrder: 'sideways' });
  assert.equal(invalidOrder.valid, false);
  assert.match((invalidOrder as any).error, /'asc' or 'desc'/);
});

test('P08 Validation: enforces search query limits and trimming', () => {
  const normalSearch = validateListAssetsQuery({ q: '  Latitude 5420  ' });
  assert.equal(normalSearch.valid, true);
  if (normalSearch.valid) {
    assert.equal(normalSearch.data.q, 'Latitude 5420');
  }

  // Reject excessively long search strings (>100 chars)
  const longSearch = validateListAssetsQuery({ q: 'a'.repeat(101) });
  assert.equal(longSearch.valid, false);
  assert.match((longSearch as any).error, /100 characters/);
});

test('P08 Validation: parses quick filter shortcuts for status, lookups, and departments', () => {
  const res = validateListAssetsQuery({
    status: 'IN_USE,SPARE',
    department: 'DevOps',
    costCenter: 'CC-901',
    typeId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
  });

  assert.equal(res.valid, true);
  if (res.valid) {
    assert.ok(res.data.filters);
    assert.equal(res.data.filters.operator, 'AND');
    assert.equal(res.data.filters.rules.length, 4);
  }
});

test('P08 Validation: rejects malformed JSON in filters parameter', () => {
  const res = validateListAssetsQuery({ filters: '{ not valid json' });
  assert.equal(res.valid, false);
  assert.match((res as any).error, /Malformed JSON/);
});

test('P08 Validation: enforces filter nesting depth limit (max 2)', () => {
  // Depth 1: OK
  const depth1 = {
    operator: 'AND',
    rules: [{ field: 'status', operator: 'equals', value: 'IN_USE' }],
  };
  assert.equal(validateListAssetsQuery({ filters: JSON.stringify(depth1) }).valid, true);

  // Depth 2: OK
  const depth2 = {
    operator: 'AND',
    rules: [
      {
        operator: 'OR',
        rules: [
          { field: 'status', operator: 'equals', value: 'IN_USE' },
          { field: 'status', operator: 'equals', value: 'SPARE' },
        ],
      },
    ],
  };
  assert.equal(validateListAssetsQuery({ filters: JSON.stringify(depth2) }).valid, true);

  // Depth 3: Rejects
  const depth3 = {
    operator: 'AND',
    rules: [
      {
        operator: 'OR',
        rules: [
          {
            operator: 'AND',
            rules: [{ field: 'status', operator: 'equals', value: 'IN_USE' }],
          },
        ],
      },
    ],
  };
  const deepRes = validateListAssetsQuery({ filters: JSON.stringify(depth3) });
  assert.equal(deepRes.valid, false);
  assert.match((deepRes as any).error, /nesting depth exceeds/);
});

test('P08 Validation: rejects forbidden/unknown fields in filters', () => {
  const badField = {
    operator: 'AND',
    rules: [{ field: 'unsupportedField', operator: 'equals', value: 'val' }],
  };
  const res = validateListAssetsQuery({ filters: JSON.stringify(badField) });
  assert.equal(res.valid, false);
  assert.match((res as any).error, /Unsupported or unknown filter field/);
});

test('P08 Prisma Query Builder: generates parameterized where clause without raw SQL', () => {
  const where = buildPrismaWhereClause('ThinkPad', {
    operator: 'AND',
    rules: [
      {
        operator: 'OR',
        rules: [
          { field: 'status', operator: 'equals', value: 'IN_USE' },
          { field: 'status', operator: 'equals', value: 'SPARE' },
        ],
      },
      { field: 'assetNumber', operator: 'notEmpty' },
    ],
  });

  assert.ok((where as any).AND);
  const andArray = (where as any).AND;
  assert.equal(andArray.length, 2);

  // Global search clause is case-insensitive OR across text fields
  assert.ok(andArray[0].OR);
  assert.equal(andArray[0].OR[0].model.contains, 'ThinkPad');
  assert.equal(andArray[0].OR[0].model.mode, 'insensitive');

  // Group filter
  assert.ok(andArray[1].AND);
  const filterRules = andArray[1].AND;
  assert.ok(filterRules[0].OR); // Status OR group
  assert.equal(filterRules[0].OR[0].status, 'IN_USE');
  assert.equal(filterRules[0].OR[1].status, 'SPARE');

  // Empty check for optional identifier
  assert.ok(filterRules[1].AND);
  assert.deepEqual(filterRules[1].AND[0], { NOT: { assetNumber: null } });
  assert.deepEqual(filterRules[1].AND[1], { NOT: { assetNumber: '' } });
});

test('P08 Prisma OrderBy Builder: creates relation sort and deterministic tie-breaker', () => {
  // Direct field sort
  const directSort = buildPrismaOrderBy('assetNumber', 'asc');
  assert.deepEqual(directSort, [{ assetNumber: 'asc' }, { id: 'asc' }]);

  // Relation sort: type
  const typeSort = buildPrismaOrderBy('type', 'desc');
  assert.deepEqual(typeSort, [{ type: { name: 'desc' } }, { id: 'asc' }]);

  // Relation sort: acOwner
  const ownerSort = buildPrismaOrderBy('acOwner', 'asc');
  assert.deepEqual(ownerSort, [{ acOwner: { fullName: 'asc' } }, { id: 'asc' }]);
});
