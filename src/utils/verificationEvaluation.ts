import type { DatePrecisionEnum, VerificationOutcomeEnum } from '../types/verification.ts';

export interface VerificationConflictCandidate {
  id: string;
  outcome?: VerificationOutcomeEnum;
  datePrecision: DatePrecisionEnum;
  verifiedYear: number;
  verifiedMonth: number;
  verifiedDay: number | null;
  verifiedDate?: Date | null;
  verifiedYearMonth?: string | null;
  verifiedBy?: string;
  createdAt: Date;
  notes?: string | null;
}

export interface VerificationChronologyEvaluation {
  isAmbiguous: boolean;
  ambiguityReason?: 'MIXED_PRECISION_CONFLICT';
  conflictingYearMonth?: string;
  candidates?: VerificationConflictCandidate[];
  authoritativeRecord?: VerificationConflictCandidate;
}

/**
 * Deterministic chronological comparator for physical verification observations.
 * Orders verifications descending (newest first).
 *
 * Rules:
 * 1. verifiedYear: greater is strictly newer.
 * 2. verifiedMonth: greater is strictly newer.
 * 3. Within same year & month:
 *    - If both have verifiedDay (DAY precision): greater day is strictly newer.
 *    - If both are MONTH precision: deterministic tie-breaker by createdAt DESC, id DESC.
 *    - Non-negotiable Approved Policy P11-D01: If comparing DAY and MONTH in the same month,
 *      do NOT choose between competing precision records using createdAt, day 1/day 31,
 *      entry order, or an implicit tie-breaker. Returns 0 to indicate ambiguous precedence.
 * 4. When a MONTH-precision observation is the authoritative latest record, lastVerifiedAt is set to null
 *    to prevent contradictory older timestamps next to a newer month-only summary.
 */
export function compareVerificationChronology(
  a: VerificationConflictCandidate,
  b: VerificationConflictCandidate
): number {
  if (b.verifiedYear !== a.verifiedYear) {
    return b.verifiedYear - a.verifiedYear;
  }
  if (b.verifiedMonth !== a.verifiedMonth) {
    return b.verifiedMonth - a.verifiedMonth;
  }

  // Same year and month
  if (a.datePrecision === 'DAY' && b.datePrecision === 'DAY') {
    if (a.verifiedDay !== null && b.verifiedDay !== null && b.verifiedDay !== a.verifiedDay) {
      return b.verifiedDay - a.verifiedDay;
    }
  }

  if (a.datePrecision === 'MONTH' && b.datePrecision === 'MONTH') {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  }

  // Mixed DAY vs MONTH in the same calendar month:
  // Policy P11-D01 strictly prohibits automatic resolution using createdAt or invented days.
  return 0;
}

/**
 * Evaluates a set of qualifying (isSuccessful=true) verification attempts.
 * Detects whether the newest calendar month contains ambiguous mixed DAY/MONTH observations
 * requiring explicit operator resolution (Option D).
 */
export function evaluateVerificationChronology(
  records: VerificationConflictCandidate[]
): VerificationChronologyEvaluation {
  if (!records || records.length === 0) {
    return { isAmbiguous: false };
  }

  // 1. Find newest calendar month among all qualifying observations
  let maxYearMonthVal = -1;
  let newestYear = 0;
  let newestMonth = 0;

  for (const r of records) {
    const ymVal = r.verifiedYear * 12 + r.verifiedMonth;
    if (ymVal > maxYearMonthVal) {
      maxYearMonthVal = ymVal;
      newestYear = r.verifiedYear;
      newestMonth = r.verifiedMonth;
    }
  }

  const conflictingYearMonth = `${newestYear}-${String(newestMonth).padStart(2, '0')}`;

  // 2. Collect all records in the newest calendar month
  const topMonthRecords = records.filter(
    (r) => r.verifiedYear === newestYear && r.verifiedMonth === newestMonth
  );

  // 3. Check for mixed precision (both DAY and MONTH present in the same month)
  const hasDay = topMonthRecords.some((r) => r.datePrecision === 'DAY');
  const hasMonth = topMonthRecords.some((r) => r.datePrecision === 'MONTH');

  if (hasDay && hasMonth) {
    // Non-negotiable Approved Policy P11-D01:
    // Mixed DAY/MONTH observations in the same calendar month have ambiguous precedence.
    // MUST NOT choose between them using createdAt, day 1/31, entry order, or an implicit tie-breaker.
    return {
      isAmbiguous: true,
      ambiguityReason: 'MIXED_PRECISION_CONFLICT',
      conflictingYearMonth,
      candidates: topMonthRecords,
    };
  }

  // If all are DAY precision in this newest month:
  if (hasDay) {
    const sortedDays = [...topMonthRecords].sort((a, b) => {
      const dayDiff = (b.verifiedDay ?? 0) - (a.verifiedDay ?? 0);
      if (dayDiff !== 0) return dayDiff;
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    return {
      isAmbiguous: false,
      authoritativeRecord: sortedDays[0],
    };
  }

  // If all are MONTH precision in this newest month:
  const sortedMonths = [...topMonthRecords].sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  return {
    isAmbiguous: false,
    authoritativeRecord: sortedMonths[0],
  };
}
