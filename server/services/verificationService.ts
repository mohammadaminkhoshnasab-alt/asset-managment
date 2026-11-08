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
  };
  summaryChanged: boolean;
}

export interface VerificationListResult {
  verifications: PhysicalVerification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Deterministic chronological comparator for physical verification observations.
 * Orders verifications descending (newest first).
 *
 * Rules:
 * 1. verifiedYear: greater is strictly newer.
 * 2. verifiedMonth: greater is strictly newer.
 * 3. Within same year & month:
 *    - If both have verifiedDay (DAY precision): greater day is newer.
 *    - If comparing DAY and MONTH within the same month, we explicitly avoid inventing a calendar day
 *      (e.g. neither assuming day 1 nor day 31). The later recorded inspection (createdAt) serves as
 *      authoritative tie-breaker, with immutable record ID as the final deterministic fallback.
 * 4. When a MONTH-precision observation is the authoritative latest record, lastVerifiedAt is set to null
 *    to prevent contradictory older timestamps next to a newer month-only summary.
 */
export function compareVerificationChronology(
  a: {
    verifiedYear: number;
    verifiedMonth: number;
    verifiedDay: number | null;
    datePrecision: DatePrecision;
    createdAt: Date;
    id: string;
  },
  b: {
    verifiedYear: number;
    verifiedMonth: number;
    verifiedDay: number | null;
    datePrecision: DatePrecision;
    createdAt: Date;
    id: string;
  }
): number {
  if (b.verifiedYear !== a.verifiedYear) {
    return b.verifiedYear - a.verifiedYear;
  }
  if (b.verifiedMonth !== a.verifiedMonth) {
    return b.verifiedMonth - a.verifiedMonth;
  }
  if (a.verifiedDay !== null && b.verifiedDay !== null) {
    if (b.verifiedDay !== a.verifiedDay) {
      return b.verifiedDay - a.verifiedDay;
    }
  }
  const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (timeDiff !== 0) {
    return timeDiff;
  }
  return b.id.localeCompare(a.id);
}

export const verificationService = {
  /**
   * Persists a new physical verification attempt in an atomic transaction:
   * 1. Confirms target asset exists.
   * 2. Persists immutable append-only PhysicalVerification record.
   * 3. Recomputes authoritative latest verification summary from qualifying (isSuccessful=true) records.
   * 4. Updates Asset summary cache if chronology permits (no regression for backdated or unsuccessful attempts).
   * 5. Atomically logs an AssetAuditEvent with action 'PHYSICAL_VERIFICATION'.
   */
  async createVerification(
    assetId: string,
    input: CreateVerificationValidatedData,
    actor: string,
    source: AuditSource = AuditSource.API
  ): Promise<CreateVerificationResult> {
    const operationId = crypto.randomUUID();

    return await prisma.$transaction(async (tx) => {
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
          createdAt: true,
        },
      });

      let targetLastVerifiedAt: Date | null = null;
      let targetLastVerifiedYearMonth: string | null = null;
      let targetLastVerificationOutcome: VerificationOutcome | null = null;

      if (qualifyingAttempts.length > 0) {
        // Sort descending using our deterministic chronology comparator
        qualifyingAttempts.sort(compareVerificationChronology);
        const latest = qualifyingAttempts[0];

        targetLastVerifiedYearMonth = latest.verifiedYearMonth;
        targetLastVerificationOutcome = latest.outcome;

        if (latest.datePrecision === DatePrecision.DAY) {
          targetLastVerifiedAt = latest.verifiedDate;
        } else {
          // MONTH precision: verifiedDay is null. Setting lastVerifiedAt to null prevents
          // leaving a contradictory older day/timestamp next to a newer month-only summary.
          targetLastVerifiedAt = null;
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
        },
        summaryChanged,
      };
    });
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
