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
};
