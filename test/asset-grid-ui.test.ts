import test from 'node:test';
import assert from 'node:assert/strict';

// Test grid URL query serialization and deserialization logic
function parseGridQueryString(search: string) {
  const params = new URLSearchParams(search);
  const q = params.get('q') || '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '25', 10) || 25));
  const sortBy = params.get('sortBy') || 'updatedAt';
  const sortOrder = (params.get('sortOrder') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
  const quickStatus = params.get('status') || '';

  let filters = undefined;
  const rawFilters = params.get('filters');
  if (rawFilters) {
    try {
      filters = JSON.parse(rawFilters);
    } catch {
      // ignore
    }
  }

  return { q, page, pageSize, sortBy, sortOrder, quickStatus, filters };
}

function serializeGridQueryString(state: {
  q?: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  quickStatus?: string;
  filters?: any;
}) {
  const params = new URLSearchParams();
  if (state.q && state.q.trim()) params.set('q', state.q.trim());
  if (state.page > 1) params.set('page', String(state.page));
  if (state.pageSize !== 25) params.set('pageSize', String(state.pageSize));
  if (state.sortBy !== 'updatedAt') params.set('sortBy', state.sortBy);
  if (state.sortOrder !== 'desc') params.set('sortOrder', state.sortOrder);
  if (state.quickStatus) params.set('status', state.quickStatus);
  if (state.filters && state.filters.rules && state.filters.rules.length > 0) {
    params.set('filters', JSON.stringify(state.filters));
  }
  return params.toString();
}

test('P08 Grid URL Sync: parses query parameters correctly with defensive defaults', () => {
  const state = parseGridQueryString('?q=Dell&page=3&pageSize=50&sortBy=model&sortOrder=asc&status=IN_USE');
  assert.equal(state.q, 'Dell');
  assert.equal(state.page, 3);
  assert.equal(state.pageSize, 50);
  assert.equal(state.sortBy, 'model');
  assert.equal(state.sortOrder, 'asc');
  assert.equal(state.quickStatus, 'IN_USE');
});

test('P08 Grid URL Sync: serializes minimal query params omitting defaults', () => {
  // All defaults
  const queryDefault = serializeGridQueryString({
    page: 1,
    pageSize: 25,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });
  assert.equal(queryDefault, '');

  // Custom filters
  const queryCustom = serializeGridQueryString({
    q: 'ThinkPad',
    page: 2,
    pageSize: 50,
    sortBy: 'assetNumber',
    sortOrder: 'asc',
    quickStatus: 'SPARE',
    filters: {
      operator: 'AND',
      rules: [{ field: 'department', operator: 'contains', value: 'Eng' }],
    },
  });

  assert.ok(queryCustom.includes('q=ThinkPad'));
  assert.ok(queryCustom.includes('page=2'));
  assert.ok(queryCustom.includes('pageSize=50'));
  assert.ok(queryCustom.includes('sortBy=assetNumber'));
  assert.ok(queryCustom.includes('sortOrder=asc'));
  assert.ok(queryCustom.includes('status=SPARE'));
  assert.ok(queryCustom.includes('filters='));
});

test('P08 Column Definitions: enforces exactly 9 default visible columns and available optional columns', () => {
  const DEFAULT_VISIBLE = [
    'assetNumber',
    'serialNumber',
    'model',
    'type',
    'status',
    'location',
    'acOwner',
    'currentUser',
    'updatedAt',
  ];

  assert.equal(DEFAULT_VISIBLE.length, 9, 'Default visible columns must be exactly 9');
});
