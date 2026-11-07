import crypto from 'crypto';
import { prisma } from '../db/client.ts';
import { AuditSource, Prisma } from '@prisma/client';
import type { Asset, AssetAuditEvent } from '@prisma/client';
import type {
  CreateAssetValidatedData,
  PatchAssetValidatedData,
} from '../validators/assetValidators.ts';
import {
  buildPrismaWhereClause,
  buildPrismaOrderBy,
} from '../validators/assetListValidators.ts';
import type { ParsedListAssetsQuery } from '../validators/assetListValidators.ts';

export class DuplicateIdentifierError extends Error {
  constructor(public readonly field: 'assetNumber' | 'serialNumber', public readonly value: string) {
    super(
      field === 'assetNumber'
        ? `Asset Number '${value}' is already in use by another asset.`
        : `Serial Number '${value}' is already in use by another asset.`
    );
    this.name = 'DuplicateIdentifierError';
  }
}

export class AssetNotFoundError extends Error {
  constructor(public readonly assetId: string) {
    super(`Asset with ID '${assetId}' not found.`);
    this.name = 'AssetNotFoundError';
  }
}

export interface UpdateAssetResult {
  asset: any;
  changed: boolean;
  event?: AssetAuditEvent;
}

export interface AssetHistoryResult {
  events: AssetAuditEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListAssetsResult {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ASSET_INCLUDE_RELATIONS = {
  type: true,
  location: true,
  deviceHealth: true,
  acOwner: true,
  currentUser: true,
} as const;

const ASSET_LIST_RELATIONS = {
  type: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  location: {
    select: {
      id: true,
      name: true,
      code: true,
      building: true,
      floor: true,
      room: true,
    },
  },
  deviceHealth: {
    select: {
      id: true,
      name: true,
    },
  },
  acOwner: {
    select: {
      id: true,
      fullName: true,
      personalCode: true,
      department: true,
    },
  },
  currentUser: {
    select: {
      id: true,
      fullName: true,
      username: true,
      department: true,
    },
  },
} as const;

/**
 * Core business service for Asset management and append-only transactional audit trail.
 */
export const assetService = {
  /**
   * Creates a new Asset and writes an initial audit record within the SAME transaction.
   */
  async createAsset(
    input: CreateAssetValidatedData,
    actor: string,
    source: AuditSource = AuditSource.API
  ): Promise<any> {
    const assetId = crypto.randomUUID();
    const operationId = crypto.randomUUID();

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Persist new asset
        const created = await tx.asset.create({
          data: {
            id: assetId,
            model: input.model,
            assetNumber: input.assetNumber,
            serialNumber: input.serialNumber,
            typeId: input.typeId,
            locationId: input.locationId,
            deviceHealthId: input.deviceHealthId,
            status: input.status,
            label: input.label,
            comment: input.comment,
            acOwnerId: input.acOwnerId,
            currentUserId: input.currentUserId,
            department: input.department,
            costCenter: input.costCenter,
            legacyNewCostCenter: input.legacyNewCostCenter,
          },
          include: ASSET_INCLUDE_RELATIONS,
        });

        // 2. Compute initialized fields for audit event
        const initializedFields: string[] = [];
        const afterSnapshot: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(input)) {
          if (value !== null && value !== undefined) {
            initializedFields.push(key);
            afterSnapshot[key] = value;
          }
        }

        // 3. Atomically persist append-only AssetAuditEvent
        await tx.assetAuditEvent.create({
          data: {
            id: crypto.randomUUID(),
            assetId: created.id,
            actor: actor || 'admin',
            source,
            action: 'CREATE',
            operationId,
            changedFields: initializedFields as any,
            beforeValues: Prisma.JsonNull,
            afterValues: afterSnapshot as any,
          },
        });

        return created;
      });
    } catch (err: any) {
      // Catch PostgreSQL unique constraint conflicts (code P2002)
      if (err.code === 'P2002') {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '');
        if (target.includes('asset_number') || target.includes('assetNumber')) {
          throw new DuplicateIdentifierError('assetNumber', input.assetNumber || '');
        }
        if (target.includes('serial_number') || target.includes('serialNumber')) {
          throw new DuplicateIdentifierError('serialNumber', input.serialNumber || '');
        }
      }
      throw err;
    }
  },

  /**
   * Retrieves a single persisted Asset by its UUID with all related lookup entities.
   */
  async getAssetById(id: string): Promise<any | null> {
    return prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE_RELATIONS,
    });
  },

  /**
   * Updates general asset fields and writes an audit event in the same transaction.
   * If no fields changed, bypasses database update and audit event (no-op).
   */
  async updateAsset(
    id: string,
    input: PatchAssetValidatedData,
    actor: string,
    source: AuditSource = AuditSource.API
  ): Promise<UpdateAssetResult> {
    // 1. Fetch current asset state
    const current = await prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE_RELATIONS,
    });

    if (!current) {
      throw new AssetNotFoundError(id);
    }

    // 2. Calculate delta and snapshots
    const changedFields: string[] = [];
    const beforeValues: Record<string, unknown> = {};
    const afterValues: Record<string, unknown> = {};
    const updateData: Record<string, unknown> = {};

    for (const [key, rawNewVal] of Object.entries(input)) {
      const currentVal = (current as any)[key];

      // Compare normalized values
      const normalizedCurrent = currentVal === undefined ? null : currentVal;
      const normalizedNew = rawNewVal === undefined ? null : rawNewVal;

      if (normalizedCurrent !== normalizedNew) {
        changedFields.push(key);
        beforeValues[key] = normalizedCurrent;
        afterValues[key] = normalizedNew;
        updateData[key] = normalizedNew;
      }
    }

    // 3. No-op detection: if no effective change occurred, skip mutation and audit
    if (changedFields.length === 0) {
      return {
        asset: current,
        changed: false,
      };
    }

    const operationId = crypto.randomUUID();

    try {
      // 4. Atomic transaction updating asset and inserting audit record
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.asset.update({
          where: { id },
          data: updateData,
          include: ASSET_INCLUDE_RELATIONS,
        });

        const auditEvent = await tx.assetAuditEvent.create({
          data: {
            id: crypto.randomUUID(),
            assetId: id,
            actor: actor || 'admin',
            source,
            action: 'UPDATE',
            operationId,
            changedFields: changedFields as any,
            beforeValues: beforeValues as any,
            afterValues: afterValues as any,
          },
        });

        return {
          asset: updated,
          changed: true,
          event: auditEvent,
        };
      });

      return result;
    } catch (err: any) {
      if (err.code === 'P2002') {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '');
        if (target.includes('asset_number') || target.includes('assetNumber')) {
          throw new DuplicateIdentifierError('assetNumber', input.assetNumber || '');
        }
        if (target.includes('serial_number') || target.includes('serialNumber')) {
          throw new DuplicateIdentifierError('serialNumber', input.serialNumber || '');
        }
      }
      throw err;
    }
  },

  /**
   * Returns immutable chronological audit history for a given asset.
   */
  async getAssetHistory(
    assetId: string,
    options?: { page?: number; limit?: number }
  ): Promise<AssetHistoryResult> {
    const assetExists = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!assetExists) {
      throw new AssetNotFoundError(assetId);
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(Math.max(1, options?.limit || 50), 100);
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.assetAuditEvent.findMany({
        where: { assetId },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.assetAuditEvent.count({
        where: { assetId },
      }),
    ]);

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /**
   * Retrieves a bounded, paginated list of assets with deterministic sorting and optional filters.
   */
  async listAssets(query: ParsedListAssetsQuery): Promise<ListAssetsResult> {
    const { page, pageSize, sortBy, sortOrder, q, filters } = query;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where = buildPrismaWhereClause(q, filters);
    const orderBy = buildPrismaOrderBy(sortBy, sortOrder);

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy,
        skip,
        take,
        include: ASSET_LIST_RELATIONS,
      }),
      prisma.asset.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },
};
