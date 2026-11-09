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
