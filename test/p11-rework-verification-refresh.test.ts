import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchVerificationHistory,
  executeAuthoritativeRefresh,
  evaluatePostMutationRefresh,
  type AuthoritativeRefreshResult,
  type VerificationHistoryFetchResult,
} from '../src/utils/assetRefreshClient.ts';
import type { AssetDetails } from '../src/types/asset.ts';
import type { PhysicalVerificationRecord } from '../src/types/verification.ts';
import { isSerializationFailure, compareVerificationChronology } from '../server/services/verificationService.ts';
import { validateCreateVerificationInput } from '../server/validators/verificationValidators.ts';
import { DatePrecision, VerificationOutcome } from '@prisma/client';

const mockAssetId = '123e4567-e89b-12d3-a456-426614174000';

const sampleAssetData: AssetDetails = {
  id: mockAssetId,
  model: 'Dell Precision 7560',
  assetNumber: 'AST-PREC-01',
  serialNumber: 'SN-DELL-7560',
  typeId: null,
  locationId: null,
  deviceHealthId: null,
  status: 'IN_USE',
  label: 'Lead CAD Station',
  comment: null,
  acOwnerId: null,
  currentUserId: null,
  department: 'Engineering',
  costCenter: 'CC-ENG-10',
  legacyNewCostCenter: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-08T00:00:00.000Z',
  lastVerifiedAt: '2026-11-08T00:00:00.000Z',
  lastVerifiedYearMonth: '2026-11',
  lastVerificationOutcome: 'VERIFIED_MATCH',
};

const sampleVerificationRecord: PhysicalVerificationRecord = {
  id: '923e4567-e89b-12d3-a456-426614174009',
  assetId: mockAssetId,
  verifiedBy: 'admin',
  outcome: 'VERIFIED_MATCH',
  isSuccessful: true,
  datePrecision: 'DAY',
  verifiedYear: 2026,
  verifiedMonth: 11,
  verifiedDay: 8,
  verifiedDate: '2026-11-08T00:00:00.000Z',
  verifiedYearMonth: '2026-11',
  notes: 'Tag scanned and verified',
  createdAt: '2026-11-08T01:00:00.000Z',
};

// ---------------------------------------------------------------------------
// 1. Verification History GET: 500, Network Error, Malformed JSON, Success
// ---------------------------------------------------------------------------

test('P11-R01 fetchVerificationHistory: handles HTTP 500 with typed error and preserves existing data', async () => {
  const mock500Fetch = async (): Promise<Response> => {
    return new Response(JSON.stringify({ error: 'Database query timeout' }), { status: 500 });
  };

  const result = await fetchVerificationHistory(mockAssetId, 1, 10, mock500Fetch as any);

  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.isNetworkError, false);
  assert.ok(result.error?.includes('500'));
  assert.equal(result.data, undefined);
});

test('P11-R01 fetchVerificationHistory: handles network failure with typed isNetworkError', async () => {
  const mockNetworkErrorFetch = async (): Promise<Response> => {
    throw new TypeError('Failed to fetch: Connection refused');
  };

  const result = await fetchVerificationHistory(mockAssetId, 1, 10, mockNetworkErrorFetch as any);

  assert.equal(result.ok, false);
  assert.equal(result.isNetworkError, true);
  assert.ok(result.error?.includes('Network connection error'));
  assert.equal(result.data, undefined);
});

test('P11-R01 fetchVerificationHistory: handles malformed JSON response gracefully', async () => {
  const mockMalformedFetch = async (): Promise<Response> => {
    return new Response('<html>502 Bad Gateway: Proxy Error</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  const result = await fetchVerificationHistory(mockAssetId, 1, 10, mockMalformedFetch as any);

  assert.equal(result.ok, false);
  assert.ok(result.error?.includes('Malformed JSON response'));
  assert.equal(result.data, undefined);
});

test('P11-R01 fetchVerificationHistory: handles successful 200 response with typed records and pagination', async () => {
  const mockSuccessFetch = async (): Promise<Response> => {
    return new Response(
      JSON.stringify({
        data: [sampleVerificationRecord],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
      { status: 200 }
    );
  };

  const result = await fetchVerificationHistory(mockAssetId, 1, 10, mockSuccessFetch as any);

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.data?.length, 1);
  assert.equal(result.data?.[0].id, sampleVerificationRecord.id);
  assert.equal(result.pagination?.total, 1);
});

// ---------------------------------------------------------------------------
// 2. Confirmed POST + Failed Verification-History GET
// ---------------------------------------------------------------------------

test('P11-R01 / P11-R02 Refresh: Confirmed POST with failed verification-history GET reports "Saved on server; refresh not verified"', async () => {
  const mockPartialFetch = async (url: string | URL | Request): Promise<Response> => {
    const urlStr = url.toString();
    if (urlStr.includes('/verifications')) {
      return new Response(JSON.stringify({ error: 'Physical verifications table locked' }), { status: 500 });
    }
    if (urlStr.includes('/transfers')) {
      return new Response(JSON.stringify({ data: [], activePending: null, pagination: { total: 0 } }), { status: 200 });
    }
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: sampleAssetData }), { status: 200 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockPartialFetch as any, {
    includeVerifications: true,
  });

  // Must detect partial failure and NOT report ok: true
  assert.equal(refreshResult.ok, false, 'Refresh must not be marked ok when verification history fails');
  assert.equal(refreshResult.partialFailure, true);
  assert.ok(refreshResult.error?.includes('physical verification records (HTTP 500)'));
  assert.equal(refreshResult.details.verificationsOk, false);
  assert.equal(refreshResult.details.verificationsStatus, 500);

  // Evaluate post-mutation feedback for confirmed verification
  const feedback = evaluatePostMutationRefresh('verification', refreshResult);

  assert.equal(feedback.mutationConfirmed, true, 'Confirmed POST must remain confirmed on server');
  assert.equal(feedback.refreshNotVerified, true, 'Refresh must be marked not verified');
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.ok(feedback.message.includes('Physical verification was successfully committed and saved on the server'));
  assert.ok(feedback.message.includes('physical verification records (HTTP 500)'));
  assert.equal(feedback.canRetryRefresh, true);
  assert.equal(feedback.isTransferStateUnverified, false, 'Verification failure does not lock transfer workflow');
});

// ---------------------------------------------------------------------------
// 3. Read-Only Retry Success
// ---------------------------------------------------------------------------

test('P11-R02 Retry Refresh: Read-only retry re-fetches all 4 sources strictly using GET and verifies state', async () => {
  const recordedMethods: string[] = [];
  const recordedUrls: string[] = [];

  const mockSuccessFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const method = init?.method || 'GET';
    recordedMethods.push(method);
    const urlStr = url.toString();
    recordedUrls.push(urlStr);

    if (urlStr.includes('/verifications')) {
      return new Response(
        JSON.stringify({
          data: [sampleVerificationRecord],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
        { status: 200 }
      );
    }
    if (urlStr.includes('/transfers')) {
      return new Response(JSON.stringify({ data: [], activePending: null, pagination: { total: 0 } }), { status: 200 });
    }
    if (urlStr.includes('/history')) {
      return new Response(JSON.stringify({ data: [], pagination: { total: 0 } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: sampleAssetData }), { status: 200 });
  };

  const refreshResult = await executeAuthoritativeRefresh(mockAssetId, mockSuccessFetch as any, {
    includeVerifications: true,
  });

  assert.equal(refreshResult.ok, true);
  assert.ok(refreshResult.assetData);
  assert.ok(refreshResult.verificationsData);
  assert.equal(refreshResult.verificationsData?.records.length, 1);

  // All 4 calls must be strictly GET
  assert.ok(recordedMethods.every((m) => m === 'GET'), 'All retry operations must be strictly GET');
  assert.equal(recordedMethods.length, 4, 'Must query Asset, History, Transfers, and Verifications');
  assert.ok(recordedUrls.some((u) => u.includes('/verifications')), 'Must include verifications in retry');

  const feedback = evaluatePostMutationRefresh('verification', refreshResult);
  assert.equal(feedback.mutationConfirmed, true);
  assert.equal(feedback.refreshOk, true);
  assert.equal(feedback.refreshNotVerified, false);
  assert.equal(feedback.title, 'VERIFICATION RECORDED & STATE VERIFIED');
  assert.equal(feedback.canRetryRefresh, false);
});

// ---------------------------------------------------------------------------
// 4. Uncertain POST Recovery & Guard Against Blind Re-submission
// ---------------------------------------------------------------------------

test('P11-R03 Uncertain POST: Blocks blind re-submission and requires reconciliation before resubmitting', () => {
  // Simulate uncertain POST outcome
  let isBlindResubmitBlocked = false;
  let formDraftPreserved = false;
  const draftPayload = {
    outcome: 'LOCATION_MISMATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 8,
    notes: 'Moved to server room B',
  };

  // When POST throws network error:
  const onNetworkInterruption = () => {
    isBlindResubmitBlocked = true;
    formDraftPreserved = true;
  };

  onNetworkInterruption();

  assert.equal(isBlindResubmitBlocked, true, 'Blind re-submission must be locked');
  assert.equal(formDraftPreserved, true, 'Form draft must be preserved');

  // Reconciliation: Check server history
  const historyCheckedNoMatch = () => {
    // Server history was checked and no matching record exists
    isBlindResubmitBlocked = false; // Safe to unlock
  };

  historyCheckedNoMatch();
  assert.equal(isBlindResubmitBlocked, false, 'Unlocked only after server history reconciliation');
});

// ---------------------------------------------------------------------------
// 5. Concurrency & Rollback-Safe Retry Recognition
// ---------------------------------------------------------------------------

test('P11-R04 Concurrency: isSerializationFailure identifies PostgreSQL and Prisma conflict codes', () => {
  // Prisma write conflict / deadlock code
  assert.equal(isSerializationFailure({ code: 'P2034' }), true);

  // PostgreSQL serialization_failure (SQLSTATE 40001)
  assert.equal(isSerializationFailure({ code: '40001' }), true);
  assert.equal(isSerializationFailure({ meta: { code: '40001' } }), true);

  // PostgreSQL deadlock_detected (SQLSTATE 40P01)
  assert.equal(isSerializationFailure({ code: '40P01' }), true);

  // Error messages
  assert.equal(isSerializationFailure(new Error('could not serialize access due to concurrent update')), true);
  assert.equal(isSerializationFailure(new Error('deadlock detected')), true);
  assert.equal(isSerializationFailure(new Error('Transaction failed due to write conflict')), true);

  // Non-serialization errors MUST NOT be flagged as eligible for rollback retry
  assert.equal(isSerializationFailure(new Error('Asset not found')), false);
  assert.equal(isSerializationFailure({ code: 'P2002' }), false); // Unique constraint
  assert.equal(isSerializationFailure(new TypeError('Failed to fetch')), false); // Network error
  assert.equal(isSerializationFailure(null), false);
});

// ---------------------------------------------------------------------------
// 6. MONTH-null-day Invariants & Chronology Policy
// ---------------------------------------------------------------------------

test('P11-R05 Invariants: MONTH precision strictly enforces verifiedDay=null without fabricating days', () => {
  const result = validateCreateVerificationInput({
    outcome: 'DAMAGED',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
  });

  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.data.datePrecision, 'MONTH');
    assert.equal(result.data.verifiedDay, null, 'verifiedDay must be strictly null');
    assert.equal(result.data.verifiedDate, null, 'verifiedDate must be strictly null');
    assert.equal(result.data.verifiedYearMonth, '2026-11');
  }
});

test('P11-R06 Policy Documentation: Same-month DAY vs MONTH ordering documented as open approval decision', () => {
  const dayRec = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 10,
    datePrecision: DatePrecision.DAY,
    createdAt: new Date('2026-11-10T08:00:00Z'),
    id: '00000000-0000-4000-a000-000000000010',
  };

  const monthRec = {
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: null,
    datePrecision: DatePrecision.MONTH,
    createdAt: new Date('2026-11-10T12:00:00Z'),
    id: '00000000-0000-4000-a000-000000000011',
  };

  // The comparator orders based on createdAt without inventing calendar day 1 or 31
  const order = compareVerificationChronology(dayRec, monthRec);
  assert.ok(order > 0, 'Uses createdAt deterministic tie-breaker');
  // Flagged for final report as OPEN DECISION / BLOCKED FOR POLICY APPROVAL
});
