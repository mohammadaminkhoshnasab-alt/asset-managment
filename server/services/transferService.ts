import crypto from 'crypto';
import { prisma } from '../db/client.ts';
import { AuditSource, TransferStatus } from '@prisma/client';
import { AssetNotFoundError } from './assetService.ts';
import type {
  CreateTransferValidatedData,
  CompleteTransferValidatedData,
  CancelTransferValidatedData,
} from '../validators/transferValidators.ts';

export class TransferNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferNotFoundError';
  }
}

export class TransferConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferConflictError';
  }
}

export class TransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferValidationError';
  }
}

const TRANSFER_INCLUDE_RELATIONS = {
  fromPerson: {
    select: {
      id: true,
      fullName: true,
      personalCode: true,
      username: true,
      department: true,
      costCenter: true,
    },
  },
  toPerson: {
    select: {
      id: true,
      fullName: true,
      personalCode: true,
      username: true,
      department: true,
      costCenter: true,
    },
  },
  fromCurrentUser: {
    select: {
      id: true,
      fullName: true,
      personalCode: true,
      username: true,
      department: true,
      costCenter: true,
    },
  },
  toCurrentUser: {
    select: {
      id: true,
      fullName: true,
      personalCode: true,
      username: true,
      department: true,
      costCenter: true,
    },
  },
  fromLocation: {
    select: {
      id: true,
      name: true,
      building: true,
      floor: true,
      room: true,
    },
  },
  toLocation: {
    select: {
      id: true,
      name: true,
      building: true,
      floor: true,
      room: true,
    },
  },
} as const;

export interface TransferPaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedTransfersResult {
  transfers: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  activePending: any | null;
}

export const transferService = {
  /**
   * Retrieves bounded transfer records for an asset with deterministic ordering (newest first with id tie-breaker),
   * pagination metadata, and active pending transfer record (accessible regardless of current page).
   */
  async getTransfers(
    assetId: string,
    options: TransferPaginationOptions = {}
  ): Promise<PaginatedTransfersResult> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!asset) {
      throw new AssetNotFoundError(assetId);
    }

    const page = Math.max(1, options.page ? Math.floor(options.page) : 1);
    const limit = Math.min(100, Math.max(1, options.limit ? Math.floor(options.limit) : 20));
    const skip = (page - 1) * limit;

    // Fetch active PENDING transfer record so it remains discoverable even on page > 1
    const activePending = await prisma.assetTransfer.findFirst({
      where: {
        assetId,
        status: TransferStatus.PENDING,
      },
      include: TRANSFER_INCLUDE_RELATIONS,
    });

    // Total transfers count for accurate pagination metadata
    const total = await prisma.assetTransfer.count({
      where: { assetId },
    });

    // Bounded fetch with deterministic newest-first ordering and id tie-breaker
    const transfers = await prisma.assetTransfer.findMany({
      where: { assetId },
      orderBy: [
        { requestedAt: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: limit,
      include: TRANSFER_INCLUDE_RELATIONS,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      transfers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      activePending,
    };
  },

  /**
   * Creates a new PENDING transfer snapshotting origin values.
   * Concurrency-safe: database-enforced against check-then-write race conditions.
   * Does NOT alter the asset's current assignments.
   */
  async createPendingTransfer(
    assetId: string,
    input: CreateTransferValidatedData,
    actor: string
  ) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new AssetNotFoundError(assetId);
    }

    // Conservative conflict detection: reject duplicate active pending transfers early
    const existingPending = await prisma.assetTransfer.findFirst({
      where: {
        assetId,
        status: TransferStatus.PENDING,
      },
      select: { id: true, requestedAt: true, eformNumber: true },
    });

    if (existingPending) {
      throw new TransferConflictError(
        `Asset already has an active pending transfer (#${existingPending.id}). Complete or cancel it before initiating a new transfer.`
      );
    }

    // Validate that specified destination entities exist
    if (input.changeAcOwner && input.toPersonId) {
      const person = await prisma.person.findUnique({
        where: { id: input.toPersonId },
        select: { id: true },
      });
      if (!person) {
        throw new TransferValidationError(
          `Destination AC Owner Person with ID '${input.toPersonId}' not found.`
        );
      }
    }

    if (input.changeCurrentUser && input.toCurrentUserId) {
      const person = await prisma.person.findUnique({
        where: { id: input.toCurrentUserId },
        select: { id: true },
      });
      if (!person) {
        throw new TransferValidationError(
          `Destination Current User Person with ID '${input.toCurrentUserId}' not found.`
        );
      }
    }

    if (input.changeLocation && input.toLocationId) {
      const location = await prisma.location.findUnique({
        where: { id: input.toLocationId },
        select: { id: true },
      });
      if (!location) {
        throw new TransferValidationError(
          `Destination Location with ID '${input.toLocationId}' not found.`
        );
      }
    }

    // Persist new PENDING transfer record
    // Explicit origin snapshotting preserves full history before completion
    try {
      const createdTransfer = await prisma.assetTransfer.create({
        data: {
          id: crypto.randomUUID(),
          assetId,
          fromPersonId: asset.acOwnerId,
          toPersonId: input.changeAcOwner ? input.toPersonId : asset.acOwnerId,
          fromCurrentUserId: asset.currentUserId,
          toCurrentUserId: input.changeCurrentUser ? input.toCurrentUserId : asset.currentUserId,
          fromDepartment: asset.department,
          toDepartment: input.changeDepartment ? input.toDepartment : asset.department,
          fromCostCenter: asset.costCenter,
          toCostCenter: input.changeCostCenter ? input.toCostCenter : asset.costCenter,
          fromLocationId: asset.locationId,
          toLocationId: input.changeLocation ? input.toLocationId : asset.locationId,
          changeAcOwner: input.changeAcOwner,
          changeCurrentUser: input.changeCurrentUser,
          changeDepartment: input.changeDepartment,
          changeCostCenter: input.changeCostCenter,
          changeLocation: input.changeLocation,
          eformNumber: input.eformNumber,
          notes: input.notes,
          status: TransferStatus.PENDING,
          createdBy: actor || 'admin',
        },
        include: TRANSFER_INCLUDE_RELATIONS,
      });

      return createdTransfer;
    } catch (err: any) {
      // Map PostgreSQL partial unique index / Prisma P2002 conflict to TransferConflictError (HTTP 409)
      if (
        err?.code === 'P2002' ||
        (typeof err?.message === 'string' &&
          (err.message.includes('asset_transfers_asset_id_pending_unique') ||
            err.message.includes('unique constraint') ||
            err.message.includes('Unique constraint failed')))
      ) {
        throw new TransferConflictError(
          'Asset already has an active pending transfer. Complete or cancel it before initiating a new transfer.'
        );
      }
      throw err;
    }
  },

  /**
   * Completes a PENDING transfer atomically:
   * 1. Validates non-empty eForm Number (can repeat across different assets).
   * 2. Exactly-once status-guarded transition on AssetTransfer.
   * 3. Concurrency-safe compare-and-set conditional update on Asset changed dimensions.
   * 4. Single transaction rollback ensures consistency and exactly one audit event.
   */
  async completeTransfer(
    assetId: string,
    transferId: string,
    input: CompleteTransferValidatedData,
    actor: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.assetTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.assetId !== assetId) {
        throw new TransferNotFoundError(
          `Transfer record '${transferId}' was not found for asset '${assetId}'.`
        );
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new TransferConflictError(
          `Cannot complete transfer: Record is currently in '${transfer.status}' status (only PENDING transfers can be completed).`
        );
      }

      // Validate required non-empty trimmed eForm Number
      const finalEformNumber = (input.eformNumber !== undefined ? input.eformNumber : transfer.eformNumber || '').trim();
      if (!finalEformNumber || finalEformNumber.length === 0) {
        throw new TransferValidationError(
          'A non-empty eForm Number is mandatory to complete a transfer.'
        );
      }

      // Validate destination entities still exist
      if (transfer.changeAcOwner && transfer.toPersonId) {
        const p = await tx.person.findUnique({ where: { id: transfer.toPersonId } });
        if (!p) {
          throw new TransferValidationError(
            `Destination AC Owner Person with ID '${transfer.toPersonId}' no longer exists.`
          );
        }
      }
      if (transfer.changeCurrentUser && transfer.toCurrentUserId) {
        const p = await tx.person.findUnique({ where: { id: transfer.toCurrentUserId } });
        if (!p) {
          throw new TransferValidationError(
            `Destination Current User Person with ID '${transfer.toCurrentUserId}' no longer exists.`
          );
        }
      }
      if (transfer.changeLocation && transfer.toLocationId) {
        const l = await tx.location.findUnique({ where: { id: transfer.toLocationId } });
        if (!l) {
          throw new TransferValidationError(
            `Destination Location with ID '${transfer.toLocationId}' no longer exists.`
          );
        }
      }

      // 1. Status-guarded atomic conditional transition on AssetTransfer (Exactly-Once guarantee)
      const updatedNotes = input.notes
        ? transfer.notes
          ? `${transfer.notes}\n[Completion Note]: ${input.notes}`
          : input.notes
        : transfer.notes;

      const transferUpdateResult = await tx.assetTransfer.updateMany({
        where: {
          id: transferId,
          assetId: assetId,
          status: TransferStatus.PENDING,
        },
        data: {
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
          eformNumber: finalEformNumber,
          notes: updatedNotes,
        },
      });

      if (transferUpdateResult.count === 0) {
        const currentRecord = await tx.assetTransfer.findUnique({ where: { id: transferId } });
        throw new TransferConflictError(
          `Cannot complete transfer: Record is currently in '${currentRecord?.status || 'UNKNOWN'}' status (only PENDING transfers can be completed).`
        );
      }

      // 2. Concurrency-safe Compare-and-Set conditional update on Asset
      // Conditionally updates ONLY if current asset values match the origin snapshot of changed dimensions
      const assetWhere: Record<string, unknown> = { id: assetId };
      const assetUpdateData: Record<string, unknown> = {};
      const changedFields: string[] = [];
      const beforeValues: Record<string, unknown> = {};
      const afterValues: Record<string, unknown> = {};

      if (transfer.changeAcOwner) {
        assetWhere.acOwnerId = transfer.fromPersonId;
        assetUpdateData.acOwnerId = transfer.toPersonId;
        changedFields.push('acOwnerId');
        beforeValues.acOwnerId = transfer.fromPersonId;
        afterValues.acOwnerId = transfer.toPersonId;
      }
      if (transfer.changeCurrentUser) {
        assetWhere.currentUserId = transfer.fromCurrentUserId;
        assetUpdateData.currentUserId = transfer.toCurrentUserId;
        changedFields.push('currentUserId');
        beforeValues.currentUserId = transfer.fromCurrentUserId;
        afterValues.currentUserId = transfer.toCurrentUserId;
      }
      if (transfer.changeDepartment) {
        assetWhere.department = transfer.fromDepartment;
        assetUpdateData.department = transfer.toDepartment;
        changedFields.push('department');
        beforeValues.department = transfer.fromDepartment;
        afterValues.department = transfer.toDepartment;
      }
      if (transfer.changeCostCenter) {
        assetWhere.costCenter = transfer.fromCostCenter;
        assetUpdateData.costCenter = transfer.toCostCenter;
        changedFields.push('costCenter');
        beforeValues.costCenter = transfer.fromCostCenter;
        afterValues.costCenter = transfer.toCostCenter;
      }
      if (transfer.changeLocation) {
        assetWhere.locationId = transfer.fromLocationId;
        assetUpdateData.locationId = transfer.toLocationId;
        changedFields.push('locationId');
        beforeValues.locationId = transfer.fromLocationId;
        afterValues.locationId = transfer.toLocationId;
      }

      const assetUpdateResult = await tx.asset.updateMany({
        where: assetWhere,
        data: assetUpdateData,
      });

      if (assetUpdateResult.count === 0) {
        throw new TransferConflictError(
          "Stale transfer state detected: One or more asset assignment fields have changed since this transfer was created."
        );
      }

      // Fetch the updated asset and transfer records for truthful response payload
      const updatedAsset = await tx.asset.findUnique({
        where: { id: assetId },
        include: {
          type: true,
          location: true,
          deviceHealth: true,
          acOwner: true,
          currentUser: true,
        },
      });

      const completedTransfer = await tx.assetTransfer.findUnique({
        where: { id: transferId },
        include: TRANSFER_INCLUDE_RELATIONS,
      });

      // 3. Append Transactional Audit Event (Exactly-once, guaranteed by transaction)
      const operationId = crypto.randomUUID();
      const auditEvent = await tx.assetAuditEvent.create({
        data: {
          id: crypto.randomUUID(),
          assetId,
          actor: actor || 'admin',
          source: AuditSource.UI,
          action: 'TRANSFER',
          operationId,
          eformNumber: finalEformNumber,
          changedFields: changedFields as any,
          beforeValues: beforeValues as any,
          afterValues: afterValues as any,
        },
      });

      return {
        transfer: completedTransfer!,
        asset: updatedAsset!,
        auditEvent,
      };
    });
  },

  /**
   * Cancels a PENDING transfer atomically:
   * 1. Status-guarded atomic updateMany guarantees exactly-once cancellation.
   * 2. Asset assignment values remain strictly unchanged.
   * 3. Records truthful transfer-scoped audit event (transferStatus, never Asset.status).
   */
  async cancelTransfer(
    assetId: string,
    transferId: string,
    input: CancelTransferValidatedData,
    actor: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const transfer = await tx.assetTransfer.findUnique({
        where: { id: transferId },
      });

      if (!transfer || transfer.assetId !== assetId) {
        throw new TransferNotFoundError(
          `Transfer record '${transferId}' was not found for asset '${assetId}'.`
        );
      }

      if (transfer.status !== TransferStatus.PENDING) {
        throw new TransferConflictError(
          `Cannot cancel transfer: Record is currently in '${transfer.status}' status (only PENDING transfers can be cancelled).`
        );
      }

      const updatedNotes = input.notes
        ? transfer.notes
          ? `${transfer.notes}\n[Cancellation Note]: ${input.notes}`
          : input.notes
        : transfer.notes;

      // Exactly-once status-guarded atomic update
      const updateResult = await tx.assetTransfer.updateMany({
        where: {
          id: transferId,
          assetId: assetId,
          status: TransferStatus.PENDING,
        },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: updatedNotes,
        },
      });

      if (updateResult.count === 0) {
        const currentRecord = await tx.assetTransfer.findUnique({ where: { id: transferId } });
        throw new TransferConflictError(
          `Cannot cancel transfer: Record is currently in '${currentRecord?.status || 'UNKNOWN'}' status (only PENDING transfers can be cancelled).`
        );
      }

      const cancelledTransfer = await tx.assetTransfer.findUnique({
        where: { id: transferId },
        include: TRANSFER_INCLUDE_RELATIONS,
      });

      // Truthful transfer-scoped audit event:
      // Asset.status does NOT change! Clearly scoped to transferStatus and identifies the transfer record.
      const operationId = crypto.randomUUID();
      const auditEvent = await tx.assetAuditEvent.create({
        data: {
          id: crypto.randomUUID(),
          assetId,
          actor: actor || 'admin',
          source: AuditSource.UI,
          action: 'TRANSFER_CANCELLED',
          operationId,
          eformNumber: transfer.eformNumber,
          changedFields: ['transferStatus'] as any,
          beforeValues: { transferStatus: 'PENDING', transferId: transfer.id } as any,
          afterValues: { transferStatus: 'CANCELLED', transferId: transfer.id } as any,
        },
      });

      return {
        transfer: cancelledTransfer!,
        auditEvent,
      };
    });
  },
};
