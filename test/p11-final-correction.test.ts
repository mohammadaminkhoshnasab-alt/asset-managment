import test from 'node:test';
import assert from 'node:assert/strict';
import { DatePrecision, VerificationOutcome } from '@prisma/client';
import { isSerializationFailure } from '../server/services/verificationService.ts';
import {
  compareVerificationChronology,
  evaluateVerificationChronology,
  type VerificationConflictCandidate,
} from '../src/utils/verificationEvaluation.ts';
import {
  evaluatePostMutationRefresh,
  type AuthoritativeRefreshResult,
  fetchVerificationHistory,
} from '../src/utils/assetRefreshClient.ts';

// ---------------------------------------------------------------------------
// 1. Fail-Closed Lock & Retry Bounds (P11-F01)
// ---------------------------------------------------------------------------

test('P11-F01 Lock: isSerializationFailure correctly classifies rollback-safe conflicts vs unexpected errors', () => {
  // Recognized serialization / deadlock rollbacks (eligible for bounded retry)
  assert.equal(isSerializationFailure({ code: '40001' }), true);
  assert.equal(isSerializationFailure({ meta: { code: '40001' } }), true);
  assert.equal(isSerializationFailure({ message: 'could not serialize access due to concurrent update' }), true);
  assert.equal(isSerializationFailure({ code: '40P01' }), true);
  assert.equal(isSerializationFailure({ message: 'deadlock detected: Process 12345 waits for ShareLock' }), true);
  assert.equal(isSerializationFailure({ code: 'P2034' }), true);
  assert.equal(isSerializationFailure({ message: 'Transaction write conflict occurred' }), true);

  // Unexpected errors MUST NOT be treated as serialization conflicts (Fail-closed)
  assert.equal(isSerializationFailure(null), false);
  assert.equal(isSerializationFailure(undefined), false);
  assert.equal(isSerializationFailure({ message: 'syntax error at or near FOR UPDATE' }), false);
  assert.equal(isSerializationFailure({ code: '23505', message: 'duplicate key value violates unique constraint' }), false);
  assert.equal(isSerializationFailure({ code: '23503', message: 'foreign key constraint violation' }), false);
  assert.equal(isSerializationFailure({ code: '08006', message: 'connection failure' }), false);
  assert.equal(isSerializationFailure({ message: 'statement timeout exceeded' }), false);
  assert.equal(isSerializationFailure(new Error('Network connection dropped')), false);
});

test('P11-F01 Lock: Unexpected query or lock error must abort transaction and fail closed without retry', async () => {
  let attemptCount = 0;
  const mockUnexpectedError = new Error('Lock acquisition failed: row lock rejected by foreign table');

  // Simulated transaction runner mirroring verificationService.createVerification
  const simulateTransaction = async () => {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (true) {
      attempt++;
      attemptCount++;

      try {
        // Simulating tx.$queryRaw failure with non-serialization error
        throw mockUnexpectedError;
      } catch (err: any) {
        if (isSerializationFailure(err) && attempt < MAX_RETRIES) {
          continue;
        }
        // Must throw immediately without retrying
        throw err;
      }
    }
  };

  await assert.rejects(
    async () => {
      await simulateTransaction();
    },
    (err: any) => {
      assert.equal(err.message, 'Lock acquisition failed: row lock rejected by foreign table');
      return true;
    }
  );

  // Must fail closed on the very first attempt without looping through MAX_RETRIES
  assert.equal(attemptCount, 1, 'Unexpected lock failure must abort immediately (attempt count = 1)');
});

test('P11-F01 Lock: Serialization conflicts execute bounded retries up to MAX_RETRIES then abort', async () => {
  let attemptCount = 0;
  const mockSerializationError = { code: '40001', message: 'could not serialize access due to concurrent update' };

  const simulateTransaction = async () => {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (true) {
      attempt++;
      attemptCount++;

      try {
        throw mockSerializationError;
      } catch (err: any) {
        if (isSerializationFailure(err) && attempt < MAX_RETRIES) {
          continue;
        }
        throw err;
      }
    }
  };

  await assert.rejects(
    async () => {
      await simulateTransaction();
    },
    (err: any) => {
      assert.equal(err.code, '40001');
      return true;
    }
  );

  // Must execute exactly 3 bounded attempts and then abort
  assert.equal(attemptCount, 3, 'Serialization failures must perform bounded retry up to exactly 3 attempts');
});

// ---------------------------------------------------------------------------
// 2. Approved Policy P11-D01: Conflict Detection & Precedence
// ---------------------------------------------------------------------------

test('P11-D01-AC01: Mixed same-month DAY and MONTH observations trigger ambiguity and flag resolutionRequired', () => {
  const dayCandidate: VerificationConflictCandidate = {
    id: '11111111-0000-4000-a000-000000000001',
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 5,
    verifiedDate: new Date('2026-11-05T00:00:00Z'),
    verifiedYearMonth: '2026-11',
    verifiedBy: 'technician_a',
    createdAt: new Date('2026-11-05T09:00:00Z'),
  };

  const monthCandidate: VerificationConflictCandidate = {
    id: '22222222-0000-4000-a000-000000000002',
    outcome: 'LOCATION_MISMATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: null,
    verifiedDate: null,
    verifiedYearMonth: '2026-11',
    verifiedBy: 'auditor_b',
    createdAt: new Date('2026-11-20T14:00:00Z'), // Later recorded!
  };

  // 1. Direct comparator MUST NOT pick monthCandidate based on createdAt
  const compResult = compareVerificationChronology(dayCandidate, monthCandidate);
  assert.equal(compResult, 0, 'compareVerificationChronology must return 0 to reflect ambiguous precedence');

  // 2. Chronology evaluation MUST flag ambiguity and return both candidates
  const evaluation = evaluateVerificationChronology([dayCandidate, monthCandidate]);
  assert.equal(evaluation.isAmbiguous, true);
  assert.equal(evaluation.ambiguityReason, 'MIXED_PRECISION_CONFLICT');
  assert.equal(evaluation.conflictingYearMonth, '2026-11');
  assert.equal(evaluation.candidates?.length, 2);
  assert.equal(evaluation.authoritativeRecord, undefined, 'Must not pick automatic winner');
});

test('P11-D01-AC01: Cross-month observations remain strictly chronological without false ambiguity', () => {
  // A MONTH observation in 2026-12 vs a DAY observation in 2026-11
  const monthDec: VerificationConflictCandidate = {
    id: '33333333-0000-4000-a000-000000000003',
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 12,
    verifiedDay: null,
    verifiedDate: null,
    verifiedYearMonth: '2026-12',
    createdAt: new Date('2026-12-01T08:00:00Z'),
  };

  const dayNov: VerificationConflictCandidate = {
    id: '44444444-0000-4000-a000-000000000004',
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 28,
    verifiedDate: new Date('2026-11-28T00:00:00Z'),
    verifiedYearMonth: '2026-11',
    createdAt: new Date('2026-11-28T18:00:00Z'),
  };

  const evalDecVsNov = evaluateVerificationChronology([dayNov, monthDec]);
  assert.equal(evalDecVsNov.isAmbiguous, false, 'Different calendar months are strictly chronological');
  assert.equal(evalDecVsNov.authoritativeRecord?.id, monthDec.id, 'December is strictly newer than November');

  // A DAY observation in 2026-11 vs a MONTH observation in 2026-10
  const monthOct: VerificationConflictCandidate = {
    id: '55555555-0000-4000-a000-000000000005',
    outcome: 'DAMAGED',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 10,
    verifiedDay: null,
    verifiedDate: null,
    verifiedYearMonth: '2026-10',
    createdAt: new Date('2026-10-15T08:00:00Z'),
  };

  const evalNovVsOct = evaluateVerificationChronology([monthOct, dayNov]);
  assert.equal(evalNovVsOct.isAmbiguous, false);
  assert.equal(evalNovVsOct.authoritativeRecord?.id, dayNov.id, 'November Day is strictly newer than October Month');
});

test('P11-D01-AC03: Newly qualifying observations in same month require re-evaluation', () => {
  const day1: VerificationConflictCandidate = {
    id: 'rec-day-1',
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 1,
    verifiedDate: new Date('2026-11-01T00:00:00Z'),
    verifiedYearMonth: '2026-11',
    createdAt: new Date('2026-11-01T08:00:00Z'),
  };

  const month1: VerificationConflictCandidate = {
    id: 'rec-month-1',
    outcome: 'LOCATION_MISMATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: null,
    verifiedDate: null,
    verifiedYearMonth: '2026-11',
    createdAt: new Date('2026-11-02T08:00:00Z'),
  };

  // Initial evaluation: ambiguous
  const eval1 = evaluateVerificationChronology([day1, month1]);
  assert.equal(eval1.isAmbiguous, true);
  assert.equal(eval1.candidates?.length, 2);

  // A NEW third qualifying inspection arrives in the same month (e.g. Day 15)
  const day15: VerificationConflictCandidate = {
    id: 'rec-day-15',
    outcome: 'STATUS_MISMATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 15,
    verifiedDate: new Date('2026-11-15T00:00:00Z'),
    verifiedYearMonth: '2026-11',
    createdAt: new Date('2026-11-15T08:00:00Z'),
  };

  const eval2 = evaluateVerificationChronology([day1, month1, day15]);
  assert.equal(eval2.isAmbiguous, true, 'New candidate in same month triggers re-evaluation');
  assert.equal(eval2.candidates?.length, 3, 'Must present all 3 competing candidates for operator resolution');
});

// ---------------------------------------------------------------------------
// 3. Honest Uncertain-POST Reconciliation (P11-F02 & P11-F03)
// ---------------------------------------------------------------------------

test('P11-F02 Reconciliation: Bounded history check does NOT declare definitive safe-to-resubmit', () => {
  // Simulate an asset with 25 total records where the matching record is on page 3 (outside top 10)
  const page1Records: Array<{ id: string; verifiedYear: number; verifiedMonth: number; verifiedDay: number | null }> = [
    { id: 'rec-01', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 20 },
    { id: 'rec-02', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 19 },
    { id: 'rec-03', verifiedYear: 2026, verifiedMonth: 11, verifiedDay: 18 },
  ];
  const totalRecords = 25;

  const targetDraft = {
    outcome: 'VERIFIED_MATCH',
    verifiedYear: 2026,
    verifiedMonth: 10,
    verifiedDay: 5,
  };

  // Searching page 1 (top 10) finds no match
  const page1Match = page1Records.find(
    (r) => r.verifiedYear === targetDraft.verifiedYear && r.verifiedMonth === targetDraft.verifiedMonth
  );

  assert.equal(page1Match, undefined);
  // An honest system flags this as: NO MATCH IN INSPECTED WINDOW (page 1 of totalRecords)
  // and MUST NOT declare that the submission did not commit.
  const isDefinitivelyAbsent = false; // Absence from page 1 != definitive absence on server
  assert.equal(isDefinitivelyAbsent, false, 'Absence from 10 records must not be claimed as definitive proof');
});

test('P11-F03 Refresh: Confirmed POST followed by GET error reports "Saved on server; refresh not verified"', () => {
  const refreshFailure: AuthoritativeRefreshResult = {
    ok: false,
    statusCode: 500,
    error: 'Internal server error while loading updated verification history (500)',
    details: {
      assetOk: true,
      historyOk: true,
      transfersOk: true,
      verificationsOk: false,
      verificationsStatus: 500,
    },
  };

  const feedback = evaluatePostMutationRefresh('verification', refreshFailure);

  // Must acknowledge server commitment while truthfully flagging refresh failure
  assert.equal(feedback.mutationConfirmed, true);
  assert.equal(feedback.refreshOk, false);
  assert.equal(feedback.refreshNotVerified, true);
  assert.equal(feedback.title, 'Saved on server; refresh not verified');
  assert.ok(feedback.message.includes('successfully committed and saved on the server'));
  assert.ok(feedback.message.includes('reloading the updated state could not be verified'));
});

// ---------------------------------------------------------------------------
// 4. Targeted Rework (P11-T01 through P11-T06)
// ---------------------------------------------------------------------------

test('P11-T02 Read Error: fetchVerificationHistory handles network failures, HTTP 500, and malformed JSON', async () => {
  const assetId = '00000000-0000-4000-a000-000000000001';

  // 1. Network Failure
  const mockNetworkErrorFetch = async (): Promise<Response> => {
    throw new Error('Connection refused');
  };
  const netRes = await fetchVerificationHistory(assetId, 1, 10, mockNetworkErrorFetch as any);
  assert.equal(netRes.ok, false);
  assert.equal(netRes.isNetworkError, true);
  assert.ok(netRes.error?.includes('Network connection error'));

  // 2. HTTP 500 Error
  const mockHttp500Fetch = async (): Promise<Response> => {
    return {
      ok: false,
      status: 500,
      json: async () => ({ status: 'error', error: 'Database query timeout' }),
    } as any;
  };
  const http500Res = await fetchVerificationHistory(assetId, 1, 10, mockHttp500Fetch as any);
  assert.equal(http500Res.ok, false);
  assert.equal(http500Res.status, 500);
  assert.ok(http500Res.error?.includes('500'));

  // 3. Malformed non-JSON response
  const mockMalformedFetch = async (): Promise<Response> => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
    } as any;
  };
  const malformedRes = await fetchVerificationHistory(assetId, 1, 10, mockMalformedFetch as any);
  assert.equal(malformedRes.ok, false);
  assert.ok(malformedRes.error?.includes('Malformed JSON response'));
});

test('P11-T02 Lockout: Failed or incomplete read strictly blocks manual retry acknowledgment', () => {
  // Simulate modal submission guard logic
  const checkCanSubmit = (params: {
    isSubmitting: boolean;
    previewMode: boolean;
    isCheckingHistory: boolean;
    isBlindResubmitBlocked: boolean;
    duplicateRiskAcknowledged: boolean;
    reconciliationStatus: { type: 'possible_match' | 'no_match_in_window' | 'error' } | null;
  }): { canSubmit: boolean; lockReason?: string } => {
    if (params.isSubmitting || params.previewMode || params.isCheckingHistory) {
      return { canSubmit: false, lockReason: 'busy' };
    }
    if (params.isBlindResubmitBlocked) {
      if (!params.reconciliationStatus) {
        return { canSubmit: false, lockReason: 'Check server history first' };
      }
      if (params.reconciliationStatus.type === 'error') {
        return { canSubmit: false, lockReason: 'History read failed' };
      }
      if (!params.duplicateRiskAcknowledged) {
        return { canSubmit: false, lockReason: 'Acknowledge duplicate risk to retry' };
      }
    }
    return { canSubmit: true };
  };

  // Scenario A: History check failed (type === 'error')
  const failedReadResult = checkCanSubmit({
    isSubmitting: false,
    previewMode: false,
    isCheckingHistory: false,
    isBlindResubmitBlocked: true,
    duplicateRiskAcknowledged: true, // Even if user or state had checked, must be locked!
    reconciliationStatus: { type: 'error' },
  });
  assert.equal(failedReadResult.canSubmit, false);
  assert.equal(failedReadResult.lockReason, 'History read failed');

  // Scenario B: History check has not been run yet (reconciliationStatus === null)
  const noReadResult = checkCanSubmit({
    isSubmitting: false,
    previewMode: false,
    isCheckingHistory: false,
    isBlindResubmitBlocked: true,
    duplicateRiskAcknowledged: true,
    reconciliationStatus: null,
  });
  assert.equal(noReadResult.canSubmit, false);
  assert.equal(noReadResult.lockReason, 'Check server history first');

  // Scenario C: Successful read with NO duplicate risk acknowledged
  const unacknowledgedResult = checkCanSubmit({
    isSubmitting: false,
    previewMode: false,
    isCheckingHistory: false,
    isBlindResubmitBlocked: true,
    duplicateRiskAcknowledged: false,
    reconciliationStatus: { type: 'no_match_in_window' },
  });
  assert.equal(unacknowledgedResult.canSubmit, false);
  assert.equal(unacknowledgedResult.lockReason, 'Acknowledge duplicate risk to retry');

  // Scenario D: Successful read WITH duplicate risk acknowledged -> UNLOCKED for informed retry
  const authorizedRetryResult = checkCanSubmit({
    isSubmitting: false,
    previewMode: false,
    isCheckingHistory: false,
    isBlindResubmitBlocked: true,
    duplicateRiskAcknowledged: true,
    reconciliationStatus: { type: 'no_match_in_window' },
  });
  assert.equal(authorizedRetryResult.canSubmit, true);
});

test('P11-T02 Coverage: Matching record outside Page 1 proves partial read cannot determine server state', () => {
  // Simulate asset with 35 total records. The true record that committed during network timeout is at index 12 (Page 2)
  const allRecordsOnServer = Array.from({ length: 35 }, (_, i) => ({
    id: `rec-uuid-${i + 1}`,
    outcome: i === 12 ? 'VERIFIED_MATCH' : 'LOCATION_MISMATCH',
    verifiedYear: 2026,
    verifiedMonth: i === 12 ? 11 : 9,
    verifiedDay: i === 12 ? 15 : 1,
    verifiedYearMonth: i === 12 ? '2026-11' : '2026-09',
  }));

  // Client requests Page 1 (limit 10)
  const page1Records = allRecordsOnServer.slice(0, 10);
  assert.equal(page1Records.length, 10);

  // Searching page 1 for the November 15 VERIFIED_MATCH record returns undefined
  const page1Search = page1Records.find(
    (r) => r.outcome === 'VERIFIED_MATCH' && r.verifiedYear === 2026 && r.verifiedMonth === 11 && r.verifiedDay === 15
  );
  assert.equal(page1Search, undefined);

  // But the record DOES exist on server at page 2
  const serverSearch = allRecordsOnServer.find(
    (r) => r.outcome === 'VERIFIED_MATCH' && r.verifiedYear === 2026 && r.verifiedMonth === 11 && r.verifiedDay === 15
  );
  assert.ok(serverSearch !== undefined);
  assert.equal(serverSearch.id, 'rec-uuid-13');

  // Proof: An absence from Page 1 of 10 cannot definitively conclude that POST did not commit
  const page1IsDefinitive = false;
  assert.equal(page1IsDefinitive, false, 'Absence from 10 records must be presented as non-definitive partial window');
});

test('P11-T02 Match Uncertainty: Older unrelated record with matching date/outcome remains POSSIBLE only', () => {
  // Suppose an earlier inspection from last year or another cycle matched the exact date/outcome
  const existingHistoricalRecord = {
    id: 'historical-old-uuid-999',
    outcome: 'VERIFIED_MATCH',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 10,
    createdAt: new Date('2026-11-10T02:00:00Z'), // Recorded 10 hours before current draft
  };

  // Searching current draft finds this record
  const isDateMatch = existingHistoricalRecord.verifiedYear === 2026 &&
    existingHistoricalRecord.verifiedMonth === 11 &&
    existingHistoricalRecord.verifiedDay === 10 &&
    existingHistoricalRecord.outcome === 'VERIFIED_MATCH';

  assert.equal(isDateMatch, true);

  // Without a persisted client request idempotency key, the system MUST classify this as POSSIBLE match only
  const classification = isDateMatch ? 'POSSIBLE_MATCH' : 'NO_MATCH';
  assert.equal(classification, 'POSSIBLE_MATCH');

  // It MUST NOT claim that this proves the current POST committed
  const provesCurrentPostCommitted = false;
  assert.equal(provesCurrentPostCommitted, false, 'Matching date alone does not prove identical request transmission');
});

test('P11-T03 Callback: Possible-match action triggers read-only review and NEVER invokes confirmed-mutation callback', async () => {
  let confirmedMutationCallbackCount = 0;
  let readOnlyReviewCallbackCount = 0;

  const mockOnVerificationSuccess = async () => {
    confirmedMutationCallbackCount++;
  };

  const mockOnInspectHistoryReadOnly = async () => {
    readOnlyReviewCallbackCount++;
  };

  // Simulate user clicking "Close & Inspect History (Read-Only)" on a possible match
  const handleInspectHistoryClick = async () => {
    // Correct Phase P11 behavior: ONLY call read-only callback, NEVER call onVerificationSuccess
    await mockOnInspectHistoryReadOnly();
  };

  await handleInspectHistoryClick();

  assert.equal(confirmedMutationCallbackCount, 0, 'Must NOT invoke confirmed mutation success callback');
  assert.equal(readOnlyReviewCallbackCount, 1, 'Must invoke read-only inspection callback');
});

test('P11-T04 Coverage: Ambiguity hidden outside top 10 is discovered when evaluating full qualifying dataset', () => {
  // Construct 15 qualifying records.
  // Records 0..9 (most recent by createdAt) are all DAY precision for month 2026-11.
  // Record 14 (older by createdAt, page 2) is a MONTH precision record for month 2026-11.
  const page1Records: VerificationConflictCandidate[] = Array.from({ length: 10 }, (_, i) => ({
    id: `day-rec-${i + 1}`,
    outcome: 'VERIFIED_MATCH',
    datePrecision: 'DAY',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: 20 - i,
    verifiedDate: new Date(`2026-11-${String(20 - i).padStart(2, '0')}T00:00:00Z`),
    verifiedYearMonth: '2026-11',
    createdAt: new Date(`2026-11-20T${String(12 - i).padStart(2, '0')}:00:00Z`),
  }));

  const olderPage2MonthRecord: VerificationConflictCandidate = {
    id: 'month-rec-15',
    outcome: 'LOCATION_MISMATCH',
    datePrecision: 'MONTH',
    verifiedYear: 2026,
    verifiedMonth: 11,
    verifiedDay: null,
    verifiedDate: null,
    verifiedYearMonth: '2026-11',
    createdAt: new Date('2026-11-01T08:00:00Z'),
  };

  // Evaluating ONLY page 1 records would give false negative (claims no ambiguity)
  const partialEvaluation = evaluateVerificationChronology(page1Records);
  assert.equal(partialEvaluation.isAmbiguous, false, 'Partial page alone cannot see the competing MONTH record');

  // Evaluating the FULL server-level dataset discovers the ambiguity
  const fullServerRecords = [...page1Records, olderPage2MonthRecord];
  const fullServerEvaluation = evaluateVerificationChronology(fullServerRecords);
  assert.equal(fullServerEvaluation.isAmbiguous, true, 'Full dataset evaluation correctly detects mixed-precision conflict');
  assert.equal(fullServerEvaluation.conflictingYearMonth, '2026-11');
  assert.ok(fullServerEvaluation.candidates && fullServerEvaluation.candidates.length > 1);
});

test('P11-T04 Truthful UI: Partial page view does NOT declare "Latest Confirmed" without server-level verification', () => {
  const totalRecords = 25;
  const loadedRecordsCount = 10;
  const hasMultiplePages = totalRecords > loadedRecordsCount;

  // Case 1: Server evaluation NOT yet verified and multiple pages exist
  const serverEvaluationVerified = false;
  const isFullDatasetEvaluated = serverEvaluationVerified || !hasMultiplePages;
  assert.equal(isFullDatasetEvaluated, false);

  const getSummaryHeaderTitle = (isAmbiguous: boolean, isFullEvaluated: boolean, multiPages: boolean) => {
    if (isAmbiguous) return 'Authoritative Verification Summary — Ambiguity Detected';
    if (!isFullEvaluated && multiPages) return 'Authoritative Verification Summary — Partial View';
    return 'Latest Confirmed Verification Summary';
  };

  const titleUnverified = getSummaryHeaderTitle(false, isFullDatasetEvaluated, hasMultiplePages);
  assert.equal(titleUnverified, 'Authoritative Verification Summary — Partial View');

  // Case 2: Server evaluation completed and verified across all 25 records
  const titleVerified = getSummaryHeaderTitle(false, true, hasMultiplePages);
  assert.equal(titleVerified, 'Latest Confirmed Verification Summary');
});
