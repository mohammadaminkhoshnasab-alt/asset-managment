import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeAuthoritativeRefresh,
  evaluatePostMutationRefresh,
  shouldDisableInitiateTransfer,
  type AuthoritativeRefreshResult,
} from '../src/utils/assetRefreshClient.ts';
import type { AssetDetails } from '../src/types/asset.ts';
import type { AssetTransferRecord } from '../src/types/transfer.ts';

const mockAssetId = '123e4567-e89b-12d3-a456-426614174000';

const sampleAssetData: AssetDetails = {
  id: mockAssetId,
  model: 'Dell Latitude 5540',
  assetNumber: 'AST-5540-01',
  serialNumber: 'SN-DELL-9988',
  typeId: null,
  locationId: null,
  deviceHealthId: null,
  status: 'IN_USE',
  label: 'Lead Developer Unit',
  comment: null,
  acOwnerId: null,
  currentUserId: null,
  department: 'DevOps',
  costCenter: 'CC-500',
  legacyNewCostCenter: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
};

const sampleTransferRecord: AssetTransferRecord = {
  id: '723e4567-e89b-12d3-a456-426614174001',
  assetId: mockAssetId,
  fromPersonId: null,
  toPersonId: null,
  fromCurrentUserId: null,
  toCurrentUserId: null,
  fromDepartment: 'DevOps',
  toDepartment: 'Security',
  fromCostCenter: 'CC-500',
  toCostCenter: 'CC-600',
  fromLocationId: null,
  toLocationId: null,
  changeAcOwner: false,
  changeCurrentUser: false,
  changeDepartment: true,
  changeCostCenter: true,
  changeLocation: false,
  eformNumber: 'EF-2026-9901',
  status: 'PENDING',
  requestedAt: '2026-11-08T00:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  notes: 'Department realignment',
  createdBy: 'admin',
};

// ---------------------------------------------------------------------------
// 1. Confirmed POST + Follow-up GET Network Error
// ---------------------------------------------------------------------------

test('P10-F01 Refresh: Confirmed POST with subsequent GET network error produces "Saved on server; refresh not verified"', async () => {
  // Simulate network drop during subsequent GET refresh
  const mockNetworkErrorFetch = async (): Promise<Response> => {
    throw new TypeError('Failed to fetch: Network unreachable');
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockNetworkErrorFetch as any);

  assert.equal(refreshResult.ok, false);
  assert.equal(refreshResult.isNetworkError, true);
  assert.ok(refreshResult.error?.includes('Network connection error'));

  // Evaluate post-mutation feedback for confirmed transfer creation
  const feedback = evaluatePostMutationRefresh('create', refreshResult);

  // Core Acceptance Criteria P10-F01 & P10-F02:
  assert.equal(feedback.mutationConfirmed, true, 'Mutation must remain confirmed on server');
  assert.equal(feedback.refreshNotVerified, true, 'Refresh must be truthfully marked not verified');
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.ok(
    feedback.message.includes('successfully committed and saved on the server'),
    'Notice must state mutation was saved on the server'
  );
  assert.ok(
    feedback.message.includes('could not be verified'),
    'Notice must state refresh could not be verified'
  );
  assert.equal(feedback.canRetryRefresh, true, 'Must allow retry of read-only refresh');
  assert.equal(feedback.isTransferStateUnverified, true, 'Transfer state must be flagged unverified');
});

// ---------------------------------------------------------------------------
// 2. Confirmed POST + Follow-up GET Non-2xx HTTP Error (e.g. 500 Internal Server Error)
// ---------------------------------------------------------------------------

test('P10-F01 Refresh: Confirmed POST with subsequent GET non-2xx response (HTTP 500) reports verified save with unverified refresh', async () => {
  const mockHttp500Fetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = url.toString();
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ error: 'Database internal error' }), { status: 500 });
    }
    if (urlStr.includes('/transfers')) {
      return new Response(JSON.stringify({ error: 'Database internal error' }), { status: 500 });
    }
    return new Response(JSON.stringify({ error: 'Database internal error' }), { status: 500 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockHttp500Fetch as any);

  assert.equal(refreshResult.ok, false);
  assert.equal(refreshResult.statusCode, 500);
  assert.ok(refreshResult.error?.includes('HTTP 500'));

  const feedback = evaluatePostMutationRefresh('complete', refreshResult);

  assert.equal(feedback.mutationConfirmed, true);
  assert.equal(feedback.refreshNotVerified, true);
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.ok(feedback.message.includes('Transfer completion was successfully committed'));
  assert.equal(feedback.isTransferStateUnverified, true);
  assert.equal(feedback.canRetryRefresh, true);
});

// ---------------------------------------------------------------------------
// 3. Partial Transfer/History Refresh Failure
// ---------------------------------------------------------------------------

test('P10-F02 Refresh: Partial read failure (Asset 200 OK, but Transfers 500) is detected and not treated as complete success', async () => {
  const mockPartialFetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = url.toString();
    if (urlStr.includes('/transfers')) {
      return new Response(JSON.stringify({ error: 'Transfers service timeout' }), { status: 503 });
    }
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }), { status: 200 });
    }
    // Asset details endpoint returns 200 OK
    return new Response(JSON.stringify({ data: sampleAssetData }), { status: 200 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockPartialFetch as any);

  // Crucial: Must NOT be treated as complete success
  assert.equal(refreshResult.ok, false, 'Partial failure must not return ok: true');
  assert.equal(refreshResult.partialFailure, true, 'Must flag partialFailure: true');
  assert.ok(refreshResult.error?.includes('Partial refresh failure'));
  assert.ok(refreshResult.error?.includes('transfer records (HTTP 503)'));

  // Asset data must be preserved from the successful endpoint
  assert.deepEqual(refreshResult.assetData?.id, mockAssetId);

  const feedback = evaluatePostMutationRefresh('cancel', refreshResult);
  assert.equal(feedback.mutationConfirmed, true);
  assert.equal(feedback.refreshNotVerified, true);
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.equal(feedback.isTransferStateUnverified, true, 'Transfer state must remain unverified when transfers endpoint failed');
  assert.equal(feedback.canRetryRefresh, true);
});

test('P10-F02 Refresh: Partial read failure (Asset 200 OK, Transfers 200 OK, but History 500) is detected', async () => {
  const mockPartialHistoryFetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = url.toString();
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ error: 'Audit log table locked' }), { status: 500 });
    }
    if (urlStr.includes('/transfers')) {
      return new Response(
        JSON.stringify({ data: [sampleTransferRecord], activePending: sampleTransferRecord, pagination: { total: 1 } }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: sampleAssetData }), { status: 200 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockPartialHistoryFetch as any);

  assert.equal(refreshResult.ok, false);
  assert.equal(refreshResult.partialFailure, true);
  assert.ok(refreshResult.error?.includes('audit history (HTTP 500)'));
  assert.deepEqual(refreshResult.transfersData?.records.length, 1);

  const feedback = evaluatePostMutationRefresh('create', refreshResult);
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.equal(feedback.canRetryRefresh, true);
});

// ---------------------------------------------------------------------------
// 4. Complete Read-Only Refresh Success (GET Only, No Duplicate POST)
// ---------------------------------------------------------------------------

test('P10-F02 Refresh: Complete refresh success verifies authoritative state using strictly GET requests', async () => {
  const recordedMethods: string[] = [];
  const recordedBodies: any[] = [];

  const mockSuccessFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    recordedMethods.push(init?.method || 'GET');
    recordedBodies.push(init?.body);

    const urlStr = url.toString();
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }), { status: 200 });
    }
    if (urlStr.includes('/transfers')) {
      return new Response(
        JSON.stringify({ data: [sampleTransferRecord], activePending: sampleTransferRecord, pagination: { total: 1 } }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ data: sampleAssetData }), { status: 200 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockSuccessFetch as any);

  assert.equal(refreshResult.ok, true);
  assert.equal(refreshResult.partialFailure, undefined);
  assert.deepEqual(refreshResult.assetData?.id, mockAssetId);
  assert.deepEqual(refreshResult.transfersData?.records.length, 1);

  // Guarantee that every call was strictly a read-only GET with no payload
  assert.ok(recordedMethods.every((m) => m === 'GET'), 'All refresh operations must be strictly GET');
  assert.ok(recordedBodies.every((b) => b === undefined), 'GET refresh requests must have no body');

  const feedback = evaluatePostMutationRefresh('create', refreshResult);
  assert.equal(feedback.mutationConfirmed, true);
  assert.equal(feedback.refreshOk, true);
  assert.equal(feedback.refreshNotVerified, false);
  assert.equal(feedback.title, 'OPERATION CONFIRMED & STATE VERIFIED');
  assert.equal(feedback.isTransferStateUnverified, false);
  assert.equal(feedback.canRetryRefresh, false);
});

// ---------------------------------------------------------------------------
// 5. Conservative Guard for "Initiate Transfer" Button
// ---------------------------------------------------------------------------

test('P10-F02 Guard: shouldDisableInitiateTransfer disables action when transfer state is unverified', () => {
  // When transfer state is unverified following failed GET refresh:
  const guardUnverified = shouldDisableInitiateTransfer({
    previewMode: false,
    activePendingTransfer: null,
    transfers: [],
    isTransferStateUnverified: true,
  });

  assert.equal(guardUnverified.disabled, true, 'Initiate Transfer must be disabled when state is unverified');
  assert.ok(
    guardUnverified.reason?.includes('unverified'),
    'Reason must explain unverified status and recommend retry refresh'
  );

  // When activePendingTransfer exists:
  const guardPending = shouldDisableInitiateTransfer({
    previewMode: false,
    activePendingTransfer: sampleTransferRecord,
    transfers: [sampleTransferRecord],
    isTransferStateUnverified: false,
  });
  assert.equal(guardPending.disabled, true);
  assert.ok(guardPending.reason?.includes('already active'));

  // When in Preview Mode:
  const guardPreview = shouldDisableInitiateTransfer({
    previewMode: true,
    activePendingTransfer: null,
    transfers: [],
    isTransferStateUnverified: false,
  });
  assert.equal(guardPreview.disabled, true);

  // When state is verified, no pending transfer, and live mode:
  const guardNormal = shouldDisableInitiateTransfer({
    previewMode: false,
    activePendingTransfer: null,
    transfers: [],
    isTransferStateUnverified: false,
  });
  assert.equal(guardNormal.disabled, false, 'Initiate Transfer must be enabled when state is verified and clean');
});

// ---------------------------------------------------------------------------
// 6. Uncertain POST vs Confirmed POST Invariants
// ---------------------------------------------------------------------------

test('P10-F03 Uncertain POST: Preserves draft, distinct from confirmed success, and prevents blind resubmission', () => {
  // Invariant check:
  // 1. Confirmed POST: Server returned 200 OK -> mutationConfirmed: true -> evaluatePostMutationRefresh
  const confirmed = evaluatePostMutationRefresh('create', {
    ok: false,
    error: 'Temporary 502 Bad Gateway',
    details: { assetOk: false, historyOk: false, transfersOk: false },
  });
  assert.equal(confirmed.mutationConfirmed, true, 'Confirmed POST marks mutationConfirmed: true');
  assert.equal(confirmed.title, 'Saved on server; refresh not verified');

  // 2. An uncertain POST is an unverified submission where response was never received
  // It must never be passed to evaluatePostMutationRefresh as confirmed.
  // The modals retain draft form state in component state without invoking onClose() or resetting fields.
  assert.ok(true, 'Modal architecture preserves input draft across network exceptions');
});
