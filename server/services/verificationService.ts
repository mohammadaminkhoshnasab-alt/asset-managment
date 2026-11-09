import crypto from 'crypto';
import { prisma } from '../db/client.ts';
import { AuditSource, DatePrecision } from '@prisma/client';
import type { PhysicalVerification, VerificationOutcome } from '@prisma/client';
import { AssetNotFoundError } from './assetService.ts';
import type {
  CreateVerificationValidatedData,
  VerificationPaginationQuery,
} from '../validators/verificationValidators.ts';

export interface CreateVerificationResult {
  verification: PhysicalVerification;
  latestSummary: {
    lastVerifiedAt: Date | null;
    lastVerifiedYearMonth: string | null;
    lastVerificationOutcome: VerificationOutcome | null;
    isAmbiguous?: boolean;
    conflictingYearMonth?: string;
  };
  summaryChanged: boolean;
  isAmbiguous?: boolean;
}

export interface VerificationListResult {
  verifications: PhysicalVerification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VerificationEvaluationQuery {
  candidatePage?: number;
  candidateLimit?: number;
}

export interface BoundedVerificationEvaluationResult {
  isAmbiguous: boolean;
  ambiguityReason: string | null;
  conflictingYearMonth: string | null;
  authoritativeRecord?: PhysicalVerification | null;
  candidates: Array<{
    id: string;
    outcome: VerificationOutcome;
    datePrecision: DatePrecision;
    verifiedYear: number;
    verifiedMonth: number;
    verifiedDay: number | null;
    verifiedDate: Date | null;
    verifiedYearMonth: string | null;
    verifiedBy: string;
    createdAt: Date;
    notes: string | null;
  }>;
  candidatePagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  candidateFingerprint: string | null;
  totalQualifyingRecords: number;
  dayCountInLatestMonth: number;
  monthCountInLatestMonth: number;
  evaluatedAt: string;
}

export {
  type VerificationConflictCandidate,
  type VerificationChronologyEvaluation,
  compareVerificationChronology,
  evaluateVerificationChronology,
} from '../../src/utils/verificationEvaluation.ts';
import {
  evaluateVerificationChronology,
} from '../../src/utils/verificationEvaluation.ts';

/**
 * Detects whether a database error represents a recognized PostgreSQL serialization failure
 * (SQLSTATE 40001), deadlock detection (SQLSTATE 40P01), or Prisma transaction write conflict (P2034)
 * that rolled back the transaction and is safely eligible for a bounded retry.
 */
export function isSerializationFailure(err: any): boolean {
  if (!err) return false;
  if (err.code === 'P2034') return true; // Prisma transaction write conflict
  if (err.code === '40001' || err.meta?.code === '40001') return true; // PostgreSQL serialization failure
  if (err.code === '40P01' || err.meta?.code === '40P01') return true; // PostgreSQL deadlock detected
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  return (
    msg.includes('could not serialize access') ||
    msg.includes('deadlock detected') ||
    msg.includes('write conflict') ||
    msg.includes('serialization failure') ||
    msg.includes('p2034')
  );
}

export const verificationService = {
  /**
   * Persists a new physical verification attempt in a concurrency-safe atomic transaction:
   * 1. Uses PostgreSQL SERIALIZABLE transaction with a per-asset row-level write lock.
   * 2. Re-executes on recognized serialization/write-conflict rollbacks up to 3 bounded retries.
   * 3. Confirms target asset exists.
   * 4. Persists immutable append-only PhysicalVerification record.
   * 5. Recomputes authoritative latest verification summary from qualifying (isSuccessful=true) records.
   * 6. Updates Asset summary cache if chronology permits (no regression for backdated or unsuccessful attempts).
   * 7. Atomically logs an AssetAuditEvent with action 'PHYSICAL_VERIFICATION'.
   * 8. Guarantees verification row, summary update, and audit event commit or roll back together.
   */
  async createVerification(
    assetId: string,
    input: CreateVerificationValidatedData,
    actor: string,
    source: AuditSource = AuditSource.API
  ): Promise<CreateVerificationResult> {
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (true) {
      attempt++;
      const operationId = crypto.randomUUID();

      try {
        return await prisma.$transaction(
          async (tx) => {
            // Per-asset row-level write lock in PostgreSQL to eliminate concurrency races (Fail-closed).
            // Any failed lock or unexpected query error MUST abort the transaction and roll back.
            await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id" = ${assetId}::uuid FOR UPDATE`;

            // 1. Validate target asset exists and fetch current verification summary
            const currentAsset = await tx.asset.findUnique({
              where: { id: assetId },
              select: {
                id: true,
                model: true,
                assetNumber: true,
                status: true,
                locationId: true,
                acOwnerId: true,
                currentUserId: true,
                department: true,
                costCenter: true,
                lastVerifiedAt: true,
                lastVerifiedYearMonth: true,
                lastVerificationOutcome: true,
              },
            });

            if (!currentAsset) {
              throw new AssetNotFoundError(assetId);
            }

            // 2. Persist append-only PhysicalVerification record
            const verification = await tx.physicalVerification.create({
              data: {
                assetId,
                verifiedBy: actor,
                outcome: input.outcome,
                isSuccessful: input.isSuccessful,
                datePrecision: input.datePrecision,
                verifiedYear: input.verifiedYear,
                verifiedMonth: input.verifiedMonth,
                verifiedDay: input.verifiedDay,
                verifiedDate: input.verifiedDate,
                verifiedYearMonth: input.verifiedYearMonth,
                notes: input.notes,
              },
            });

            // 3. Authoritative Latest Summary Recomputation:
            // Only successfully completed inspections (isSuccessful: true) qualify to represent the latest confirmed summary.
            const qualifyingAttempts = await tx.physicalVerification.findMany({
              where: {
                assetId,
                isSuccessful: true,
              },
              select: {
                id: true,
                outcome: true,
                datePrecision: true,
                verifiedYear: true,
                verifiedMonth: true,
                verifiedDay: true,
                verifiedDate: true,
                verifiedYearMonth: true,
                verifiedBy: true,
                createdAt: true,
                notes: true,
              },
            });

            let targetLastVerifiedAt: Date | null = null;
            let targetLastVerifiedYearMonth: string | null = null;
            let targetLastVerificationOutcome: VerificationOutcome | null = null;
            let isAmbiguous = false;

            if (qualifyingAttempts.length > 0) {
              const evalResult = evaluateVerificationChronology(qualifyingAttempts);

              if (evalResult.isAmbiguous) {
                // Policy P11-D01: Mixed same-month DAY/MONTH observations require operator resolution.
                // Do NOT choose between them using createdAt or invented days.
                isAmbiguous = true;
                targetLastVerifiedYearMonth = evalResult.conflictingYearMonth || null;
                targetLastVerifiedAt = null;
                targetLastVerificationOutcome = null;
              } else if (evalResult.authoritativeRecord) {
                const latest = evalResult.authoritativeRecord;
                targetLastVerifiedYearMonth = latest.verifiedYearMonth ?? null;
                targetLastVerificationOutcome = (latest.outcome as VerificationOutcome) ?? null;

                if (latest.datePrecision === DatePrecision.DAY) {
                  targetLastVerifiedAt = latest.verifiedDate ?? null;
                } else {
                  // MONTH precision: verifiedDay is null. Setting lastVerifiedAt to null prevents
                  // leaving a contradictory older day/timestamp next to a newer month-only summary.
                  targetLastVerifiedAt = null;
                }
              }
            }

            // Check whether summary cache changed
            const summaryChanged =
              currentAsset.lastVerifiedYearMonth !== targetLastVerifiedYearMonth ||
              currentAsset.lastVerificationOutcome !== targetLastVerificationOutcome ||
              (currentAsset.lastVerifiedAt?.getTime() ?? null) !== (targetLastVerifiedAt?.getTime() ?? null);

            if (summaryChanged) {
              await tx.asset.update({
                where: { id: assetId },
                data: {
                  lastVerifiedAt: targetLastVerifiedAt,
                  lastVerifiedYearMonth: targetLastVerifiedYearMonth,
                  lastVerificationOutcome: targetLastVerificationOutcome,
                },
              });
            }

            // 4. Atomically persist append-only AssetAuditEvent
            const changedFields = ['verifications'];
            if (summaryChanged) {
              changedFields.push('lastVerifiedYearMonth', 'lastVerificationOutcome');
              if (targetLastVerifiedAt !== undefined) {
                changedFields.push('lastVerifiedAt');
              }
            }

            await tx.assetAuditEvent.create({
              data: {
                id: crypto.randomUUID(),
                assetId,
                actor,
                source,
                action: 'PHYSICAL_VERIFICATION',
                operationId,
                changedFields,
                beforeValues: {
                  lastVerifiedAt: currentAsset.lastVerifiedAt?.toISOString() || null,
                  lastVerifiedYearMonth: currentAsset.lastVerifiedYearMonth,
                  lastVerificationOutcome: currentAsset.lastVerificationOutcome,
                },
                afterValues: {
                  verificationId: verification.id,
                  outcome: verification.outcome,
                  isSuccessful: verification.isSuccessful,
                  datePrecision: verification.datePrecision,
                  verifiedYear: verification.verifiedYear,
                  verifiedMonth: verification.verifiedMonth,
                  verifiedDay: verification.verifiedDay,
                  verifiedDate: verification.verifiedDate?.toISOString() || null,
                  verifiedYearMonth: verification.verifiedYearMonth,
                  notes: verification.notes,
                  lastVerifiedAt: targetLastVerifiedAt?.toISOString() || null,
                  lastVerifiedYearMonth: targetLastVerifiedYearMonth,
                  lastVerificationOutcome: targetLastVerificationOutcome,
                },
              },
            });

            return {
              verification,
              latestSummary: {
                lastVerifiedAt: targetLastVerifiedAt,
                lastVerifiedYearMonth: targetLastVerifiedYearMonth,
                lastVerificationOutcome: targetLastVerificationOutcome,
                isAmbiguous,
                conflictingYearMonth: isAmbiguous ? (targetLastVerifiedYearMonth ?? undefined) : undefined,
              },
              summaryChanged,
              isAmbiguous,
            };
          },
          {
            isolationLevel: 'Serializable',
          }
        );
      } catch (err: any) {
        // Retry ONLY transactions known to have rolled back due to serialization conflicts
        if (isSerializationFailure(err) && attempt < MAX_RETRIES) {
          // Bounded backoff before retry
          await new Promise((res) => setTimeout(res, attempt * 20));
          continue;
        }
        throw err;
      }
    }
  },

  /**
   * Retrieves a bounded, paginated list of physical verification records for an asset.
   * Deterministic ordering by createdAt DESC, id DESC.
   */
  async getVerifications(
    assetId: string,
    query: VerificationPaginationQuery
  ): Promise<VerificationListResult> {
    // Validate target asset exists
    const assetExists = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!assetExists) {
      throw new AssetNotFoundError(assetId);
    }

    const page = Math.max(1, query.page);
    const limit = Math.min(Math.max(1, query.limit), 100);
    const skip = (page - 1) * limit;

    const [verifications, total] = await Promise.all([
      prisma.physicalVerification.findMany({
        where: { assetId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.physicalVerification.count({
        where: { assetId },
      }),
    ]);

    return {
      verifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Scalable server-authoritative evaluation (Policy P11-D01):
   * 1. Bounded query to find the latest eligible observation year/month.
   * 2. Bounded count aggregates to check whether both DAY and MONTH precisions occur in that latest month.
   * 3. Deterministic candidate pagination (max 100/page) that never affects the conflict verdict.
   * 4. Candidate set fingerprint (SHA-256) for optimistic concurrency / stale checks.
   */
  async getVerificationEvaluation(
    assetId: string,
    query?: VerificationEvaluationQuery
  ): Promise<BoundedVerificationEvaluationResult> {
    const assetExists = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!assetExists) {
      throw new AssetNotFoundError(assetId);
    }

    const candidatePage = Math.max(1, query?.candidatePage || 1);
    const candidateLimit = Math.min(Math.max(1, query?.candidateLimit || 10), 100);

    // 1. Determine latest qualifying observation year and month (Bounded: 1 row)
    const latestRecord = await prisma.physicalVerification.findFirst({
      where: {
        assetId,
        isSuccessful: true,
      },
      orderBy: [
        { verifiedYear: 'desc' },
        { verifiedMonth: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        verifiedYear: true,
        verifiedMonth: true,
        verifiedYearMonth: true,
      },
    });

    if (!latestRecord) {
      return {
        isAmbiguous: false,
        ambiguityReason: null,
        conflictingYearMonth: null,
        authoritativeRecord: null,
        candidates: [],
        candidatePagination: {
          page: 1,
          limit: candidateLimit,
          total: 0,
          totalPages: 1,
        },
        candidateFingerprint: null,
        totalQualifyingRecords: 0,
        dayCountInLatestMonth: 0,
        monthCountInLatestMonth: 0,
        evaluatedAt: new Date().toISOString(),
      };
    }

    const latestYear = latestRecord.verifiedYear;
    const latestMonth = latestRecord.verifiedMonth;
    const latestYearMonth =
      latestRecord.verifiedYearMonth ||
      `${latestYear}-${String(latestMonth).padStart(2, '0')}`;

    // 2. Count aggregates for precisions in latest observation period & total qualifying
    const [dayCount, monthCount, totalQualifyingRecords] = await Promise.all([
      prisma.physicalVerification.count({
        where: {
          assetId,
          isSuccessful: true,
          verifiedYear: latestYear,
          verifiedMonth: latestMonth,
          datePrecision: DatePrecision.DAY,
        },
      }),
      prisma.physicalVerification.count({
        where: {
          assetId,
          isSuccessful: true,
          verifiedYear: latestYear,
          verifiedMonth: latestMonth,
          datePrecision: DatePrecision.MONTH,
        },
      }),
      prisma.physicalVerification.count({
        where: {
          assetId,
          isSuccessful: true,
        },
      }),
    ]);

    const isAmbiguous = dayCount > 0 && monthCount > 0;

    // 3. If no ambiguity, single authoritative latest winner
    if (!isAmbiguous) {
      let authRecord: PhysicalVerification | null = null;
      if (dayCount > 0) {
        authRecord = await prisma.physicalVerification.findFirst({
          where: {
            assetId,
            isSuccessful: true,
            verifiedYear: latestYear,
            verifiedMonth: latestMonth,
            datePrecision: DatePrecision.DAY,
          },
          orderBy: [
            { verifiedDay: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        });
      } else if (monthCount > 0) {
        authRecord = await prisma.physicalVerification.findFirst({
          where: {
            assetId,
            isSuccessful: true,
            verifiedYear: latestYear,
            verifiedMonth: latestMonth,
            datePrecision: DatePrecision.MONTH,
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        });
      }

      return {
        isAmbiguous: false,
        ambiguityReason: null,
        conflictingYearMonth: null,
        authoritativeRecord: authRecord,
        candidates: [],
        candidatePagination: {
          page: 1,
          limit: candidateLimit,
          total: 0,
          totalPages: 1,
        },
        candidateFingerprint: null,
        totalQualifyingRecords,
        dayCountInLatestMonth: dayCount,
        monthCountInLatestMonth: monthCount,
        evaluatedAt: new Date().toISOString(),
      };
    }

    // 4. If ambiguous (mixed DAY & MONTH in latest month):
    const totalCandidates = dayCount + monthCount;
    const skip = (candidatePage - 1) * candidateLimit;

    // Paginated candidate records for the conflicting month
    const candidates = await prisma.physicalVerification.findMany({
      where: {
        assetId,
        isSuccessful: true,
        verifiedYear: latestYear,
        verifiedMonth: latestMonth,
      },
      orderBy: [
        { datePrecision: 'asc' }, // DAY first, then MONTH
        { verifiedDay: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: candidateLimit,
      select: {
        id: true,
        outcome: true,
        datePrecision: true,
        verifiedYear: true,
        verifiedMonth: true,
        verifiedDay: true,
        verifiedDate: true,
        verifiedYearMonth: true,
        verifiedBy: true,
        createdAt: true,
        notes: true,
      },
    });

    // Compute candidate fingerprint from all candidate keys in this conflicting month
    const allCandidateKeys = await prisma.physicalVerification.findMany({
      where: {
        assetId,
        isSuccessful: true,
        verifiedYear: latestYear,
        verifiedMonth: latestMonth,
      },
      orderBy: [{ id: 'asc' }],
      select: { id: true, createdAt: true },
    });

    const candidateFingerprint = crypto
      .createHash('sha256')
      .update(
        allCandidateKeys
          .map((c) => `${c.id}:${c.createdAt.toISOString()}`)
          .join('|')
      )
      .digest('hex');

    return {
      isAmbiguous: true,
      ambiguityReason: 'MIXED_PRECISION_CONFLICT',
      conflictingYearMonth: latestYearMonth,
      authoritativeRecord: null,
      candidates,
      candidatePagination: {
        page: candidatePage,
        limit: candidateLimit,
        total: totalCandidates,
        totalPages: Math.ceil(totalCandidates / candidateLimit) || 1,
      },
      candidateFingerprint,
      totalQualifyingRecords,
      dayCountInLatestMonth: dayCount,
      monthCountInLatestMonth: monthCount,
      evaluatedAt: new Date().toISOString(),
    };
  },
};
