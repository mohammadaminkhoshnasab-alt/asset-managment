import { Router } from 'express';
import type { Request, Response } from 'express';
import { isValidUuid } from '../validators/assetValidators.ts';
import {
  validateCreateTransferInput,
  validateCompleteTransferInput,
  validateCancelTransferInput,
  validateTransferPaginationQuery,
} from '../validators/transferValidators.ts';
import {
  transferService,
  TransferNotFoundError,
  TransferConflictError,
  TransferValidationError,
} from '../services/transferService.ts';
import { AssetNotFoundError } from '../services/assetService.ts';

export const transferRouter = Router({ mergeParams: true });

function getSessionActor(req: Request): string {
  return req.session?.username || req.admin?.username || 'admin';
}

/**
 * GET /api/assets/:assetId/transfers
 * Retrieves bounded chronological transfer records for an asset with resolved lookup relations.
 * Enforces validated page/limit pagination (max 100) and exposes any active pending transfer.
 */
transferRouter.get('/', async (req: Request, res: Response) => {
  const { assetId } = req.params;

  if (!isValidUuid(assetId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed asset ID. Expected standard RFC 4122 UUID format.',
    });
    return;
  }

  const paginationValidation = validateTransferPaginationQuery(req.query as Record<string, unknown>);
  if (!paginationValidation.valid) {
    res.status(400).json({
      status: 'error',
      error: paginationValidation.error,
      field: paginationValidation.field,
    });
    return;
  }

  try {
    const result = await transferService.getTransfers(assetId, paginationValidation.data);
    res.status(200).json({
      status: 'ok',
      data: result.transfers,
      pagination: result.pagination,
      activePending: result.activePending,
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[TransferRoute] Error fetching transfers:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve asset transfers.',
    });
  }
});

/**
 * POST /api/assets/:assetId/transfers
 * Creates a PENDING transfer with origin snapshots.
 * Does NOT alter the asset's current assignments.
 */
transferRouter.post('/', async (req: Request, res: Response) => {
  const { assetId } = req.params;

  if (!isValidUuid(assetId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed asset ID. Expected standard RFC 4122 UUID format.',
    });
    return;
  }

  const validation = validateCreateTransferInput(req.body);
  if (!validation.valid) {
    res.status(400).json({
      status: 'error',
      error: validation.error,
      field: validation.field,
    });
    return;
  }

  const actor = getSessionActor(req);

  try {
    const transfer = await transferService.createPendingTransfer(
      assetId,
      validation.data,
      actor
    );

    res.status(201).json({
      status: 'ok',
      message: 'Pending transfer created successfully. Asset assignments remain unchanged.',
      data: transfer,
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof TransferConflictError) {
      res.status(409).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof TransferValidationError) {
      res.status(400).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[TransferRoute] Error creating pending transfer:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create pending transfer due to internal server error.',
    });
  }
});

/**
 * POST /api/assets/:assetId/transfers/:transferId/complete
 * Atomically completes a PENDING transfer using required eForm Number.
 * Updates asset assignments and appends an immutable audit event in a single transaction.
 */
transferRouter.post('/:transferId/complete', async (req: Request, res: Response) => {
  const { assetId, transferId } = req.params;

  if (!isValidUuid(assetId) || !isValidUuid(transferId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed identifier format. Expected standard RFC 4122 UUID.',
    });
    return;
  }

  const validation = validateCompleteTransferInput(req.body);
  if (!validation.valid) {
    res.status(400).json({
      status: 'error',
      error: validation.error,
      field: validation.field,
    });
    return;
  }

  const actor = getSessionActor(req);

  try {
    const result = await transferService.completeTransfer(
      assetId,
      transferId,
      validation.data,
      actor
    );

    res.status(200).json({
      status: 'ok',
      message: 'Transfer completed successfully. Asset assignments updated.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof TransferNotFoundError || err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof TransferConflictError) {
      res.status(409).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof TransferValidationError) {
      res.status(400).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[TransferRoute] Error completing transfer:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to complete transfer due to internal server error.',
    });
  }
});

/**
 * POST /api/assets/:assetId/transfers/:transferId/cancel
 * Cancels a PENDING transfer.
 * Asset assignment values remain strictly unchanged.
 */
transferRouter.post('/:transferId/cancel', async (req: Request, res: Response) => {
  const { assetId, transferId } = req.params;

  if (!isValidUuid(assetId) || !isValidUuid(transferId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed identifier format. Expected standard RFC 4122 UUID.',
    });
    return;
  }

  const validation = validateCancelTransferInput(req.body);
  if (!validation.valid) {
    res.status(400).json({
      status: 'error',
      error: validation.error,
      field: validation.field,
    });
    return;
  }

  const actor = getSessionActor(req);

  try {
    const result = await transferService.cancelTransfer(
      assetId,
      transferId,
      validation.data,
      actor
    );

    res.status(200).json({
      status: 'ok',
      message: 'Transfer cancelled. Asset assignments remain unchanged.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof TransferNotFoundError || err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof TransferConflictError) {
      res.status(409).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[TransferRoute] Error cancelling transfer:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to cancel transfer due to internal server error.',
    });
  }
});
