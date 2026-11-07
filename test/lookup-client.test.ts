import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCatalogs,
  INITIAL_LOOKUP_STATE,
} from '../src/utils/lookupClient.ts';
import type { DeviceHealthLookup } from '../src/types/asset.ts';

test('P06 Lookups: fetchCatalogs handles complete success and maps DeviceHealth.name correctly', async () => {
  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/lookups/asset-types')) {
      return new Response(JSON.stringify({ data: [{ id: 't1', name: 'Laptop', isActive: true }] }), {
        status: 200,
      });
    }
    if (url.includes('/api/lookups/locations')) {
      return new Response(JSON.stringify({ data: [{ id: 'l1', name: 'HQ Building', isActive: true }] }), {
        status: 200,
      });
    }
    if (url.includes('/api/lookups/device-health')) {
      // Backend returns records with `name` (NOT `statusName`)
      const healthData: DeviceHealthLookup[] = [
        { id: 'h1', name: 'Operational - Good', description: 'Fully working', isActive: true },
      ];
      return new Response(JSON.stringify({ data: healthData }), { status: 200 });
    }
    if (url.includes('/api/people')) {
      return new Response(JSON.stringify({ data: [{ id: 'p1', fullName: 'Alice Smith', isActive: true }] }), {
        status: 200,
      });
    }
    return new Response('Not Found', { status: 404 });
  };

  const result = await fetchCatalogs(INITIAL_LOOKUP_STATE, mockFetch);

  assert.equal(result.failures.length, 0);
  assert.equal(result.summaryMessage, null);
  assert.equal(result.isAllFailed, false);
  assert.equal(result.isPartialFailure, false);

  assert.equal(result.data.assetTypes.length, 1);
  assert.equal(result.data.locations.length, 1);
  assert.equal(result.data.deviceHealth.length, 1);
  assert.equal(result.data.deviceHealth[0].name, 'Operational - Good');
  assert.equal((result.data.deviceHealth[0] as any).statusName, undefined);
  assert.equal(result.data.people.length, 1);
});

test('P06 Lookups: reports partial failure truthfully without claiming entire backend is down', async () => {
  const mockFetch: typeof fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/lookups/locations')) {
      // Simulate partial failure on locations only
      return new Response(JSON.stringify({ error: 'Database query timeout' }), { status: 500 });
    }
    if (url.includes('/api/lookups/asset-types')) {
      return new Response(JSON.stringify({ data: [{ id: 't1', name: 'Desktop Workstation' }] }), { status: 200 });
    }
    if (url.includes('/api/lookups/device-health')) {
      return new Response(JSON.stringify({ data: [{ id: 'h1', name: 'Functional' }] }), { status: 200 });
    }
    if (url.includes('/api/people')) {
      return new Response(JSON.stringify({ data: [{ id: 'p1', fullName: 'Bob Jones' }] }), { status: 200 });
    }
    return new Response('Not Found', { status: 404 });
  };

  const result = await fetchCatalogs(INITIAL_LOOKUP_STATE, mockFetch);

  assert.equal(result.isPartialFailure, true);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].catalogKey, 'locations');
  assert.equal(result.failures[0].status, 500);

  // Successfully loaded catalogs are retained
  assert.equal(result.data.assetTypes.length, 1);
  assert.equal(result.data.deviceHealth.length, 1);
  assert.equal(result.data.people.length, 1);
  assert.equal(result.data.locations.length, 0);

  // Summary message names the specific failed catalog
  assert.ok(result.summaryMessage?.includes('Partial Catalog Warning'));
  assert.ok(result.summaryMessage?.includes('Locations'));
  assert.ok(result.summaryMessage?.includes('Asset Types'));
});

test('P06 Lookups: preserves existing loaded options during transient re-fetch failures', async () => {
  const existingState = {
    assetTypes: [{ id: 't1', name: 'Pre-existing Type', isActive: true }],
    locations: [{ id: 'l1', name: 'Pre-existing Room', isActive: true }],
    deviceHealth: [{ id: 'h1', name: 'Pre-existing Health', isActive: true }],
    people: [{ id: 'p1', fullName: 'Pre-existing Person', isActive: true }],
  };

  // Re-fetch encounters network drop
  const mockFailingFetch: typeof fetch = async () => {
    throw new Error('Network offline');
  };

  const result = await fetchCatalogs(existingState, mockFailingFetch);

  assert.equal(result.failures.length, 4);
  assert.equal(result.isAllFailed, true);

  // Pre-existing catalogs must NOT be cleared on failure
  assert.equal(result.data.assetTypes.length, 1);
  assert.equal(result.data.assetTypes[0].name, 'Pre-existing Type');
  assert.equal(result.data.locations.length, 1);
  assert.equal(result.data.deviceHealth.length, 1);
  assert.equal(result.data.people.length, 1);
});

test('P06 Lookups: distinguishes 401 Unauthorized from PostgreSQL connection outage', async () => {
  const mock401Fetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ error: 'Admin session required' }), { status: 401 });
  };

  const result = await fetchCatalogs(INITIAL_LOOKUP_STATE, mock401Fetch);

  assert.equal(result.isAllFailed, true);
  assert.ok(result.summaryMessage?.includes('401 Unauthorized'));
  assert.ok(result.summaryMessage?.includes('Authentication required'));
  assert.equal(result.summaryMessage?.includes('PostgreSQL backend is currently unreachable'), false);
});

test('P06 Lookups: distinguishes 403 Forbidden from PostgreSQL connection outage', async () => {
  const mock403Fetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ error: 'CSRF token mismatched' }), { status: 403 });
  };

  const result = await fetchCatalogs(INITIAL_LOOKUP_STATE, mock403Fetch);

  assert.equal(result.isAllFailed, true);
  assert.ok(result.summaryMessage?.includes('403 Forbidden'));
  assert.ok(result.summaryMessage?.includes('Security verification failed'));
  assert.equal(result.summaryMessage?.includes('PostgreSQL backend is currently unreachable'), false);
});
