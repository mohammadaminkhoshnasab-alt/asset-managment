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

export const transferService = {
  /**
   * Retrieves all transfer records for an asset ordered newest-first.
   */
  async getTransfers(assetId: string) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });

    if (!asset) {
      throw new AssetNotFoundError(assetId);
    }

    return await prisma.assetTransfer.findMany({
      where: { assetId },
      orderBy: { requestedAt: 'desc' },
      include: TRANSFER_INCLUDE_RELATIONS,
    });
  },

  /**
   * Creates a new PENDING transfer snapshotting origin values.
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

    // Conservative conflict detection: reject duplicate active pending transfers
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
  },

  /**
   * Completes a PENDING transfer atomically:
   * 1. Validates non-empty eForm Number (can repeat across different assets).
   * 2. Checks stale conflicts (current asset values must still match origin snapshot).
   * 3. In single transaction: updates asset assignment fields, marks transfer COMPLETED, appends AssetAuditEvent.
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

      // Check current asset state for stale-state conflicts
      const currentAsset = await tx.asset.findUnique({
        where: { id: assetId },
      });

      if (!currentAsset) {
        throw new AssetNotFoundError(assetId);
      }

      if (transfer.changeAcOwner && currentAsset.acOwnerId !== transfer.fromPersonId) {
        throw new TransferConflictError(
          "Stale transfer state detected: The asset's AC Owner has changed since this transfer was created."
        );
      }
      if (transfer.changeCurrentUser && currentAsset.currentUserId !== transfer.fromCurrentUserId) {
        throw new TransferConflictError(
          "Stale transfer state detected: The asset's Current User has changed since this transfer was created."
        );
      }
      if (transfer.changeDepartment && currentAsset.department !== transfer.fromDepartment) {
        throw new TransferConflictError(
          "Stale transfer state detected: The asset's Department has changed since this transfer was created."
        );
      }
      if (transfer.changeCostCenter && currentAsset.costCenter !== transfer.fromCostCenter) {
        throw new TransferConflictError(
          "Stale transfer state detected: The asset's Cost Center has changed since this transfer was created."
        );
      }
      if (transfer.changeLocation && currentAsset.locationId !== transfer.fromLocationId) {
        throw new TransferConflictError(
          "Stale transfer state detected: The asset's Location has changed since this transfer was created."
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

      // Build atomic updates for only explicitly changed dimensions
      const assetUpdateData: Record<string, unknown> = {};
      const changedFields: string[] = [];
      const beforeValues: Record<string, unknown> = {};
      const afterValues: Record<string, unknown> = {};

      if (transfer.changeAcOwner) {
        assetUpdateData.acOwnerId = transfer.toPersonId;
        changedFields.push('acOwnerId');
        beforeValues.acOwnerId = transfer.fromPersonId;
        afterValues.acOwnerId = transfer.toPersonId;
      }
      if (transfer.changeCurrentUser) {
        assetUpdateData.currentUserId = transfer.toCurrentUserId;
        changedFields.push('currentUserId');
        beforeValues.currentUserId = transfer.fromCurrentUserId;
        afterValues.currentUserId = transfer.toCurrentUserId;
      }
      if (transfer.changeDepartment) {
        assetUpdateData.department = transfer.toDepartment;
        changedFields.push('department');
        beforeValues.department = transfer.fromDepartment;
        afterValues.department = transfer.toDepartment;
      }
      if (transfer.changeCostCenter) {
        assetUpdateData.costCenter = transfer.toCostCenter;
        changedFields.push('costCenter');
        beforeValues.costCenter = transfer.fromCostCenter;
        afterValues.costCenter = transfer.toCostCenter;
      }
      if (transfer.changeLocation) {
        assetUpdateData.locationId = transfer.toLocationId;
        changedFields.push('locationId');
        beforeValues.locationId = transfer.fromLocationId;
        afterValues.locationId = transfer.toLocationId;
      }

      // 1. Update Asset
      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: assetUpdateData,
        include: {
          type: true,
          location: true,
          deviceHealth: true,
          acOwner: true,
          currentUser: true,
        },
      });

      // 2. Mark Transfer Completed
      const completedTransfer = await tx.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.COMPLETED,
          completedAt: new Date(),
          eformNumber: finalEformNumber,
          notes: input.notes
            ? transfer.notes
              ? `${transfer.notes}\n[Completion Note]: ${input.notes}`
              : input.notes
            : transfer.notes,
        },
        include: TRANSFER_INCLUDE_RELATIONS,
      });

      // 3. Append Transactional Audit Event
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
        transfer: completedTransfer,
        asset: updatedAsset,
        auditEvent,
      };
    });
  },

  /**
   * Cancels a PENDING transfer:
   * Leaves asset assignment values strictly unchanged.
   * Marks transfer status CANCELLED with cancelledAt timestamp and records cancellation audit event.
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

      // Mark Transfer Cancelled
      const cancelledTransfer = await tx.assetTransfer.update({
        where: { id: transferId },
        data: {
          status: TransferStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: input.notes
            ? transfer.notes
              ? `${transfer.notes}\n[Cancellation Note]: ${input.notes}`
              : input.notes
            : transfer.notes,
        },
        include: TRANSFER_INCLUDE_RELATIONS,
      });

      // Append Audit Event for cancellation
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
          changedFields: ['status'] as any,
          beforeValues: { status: 'PENDING' } as any,
          afterValues: { status: 'CANCELLED' } as any,
        },
      });

      return {
        transfer: cancelledTransfer,
        auditEvent,
      };
    });
  },
};
