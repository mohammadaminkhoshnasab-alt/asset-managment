import { Router } from 'express';
import type { Request, Response } from 'express';
import { isValidUuid } from '../validators/assetValidators.ts';
import {
  validateCreateVerificationInput,
  validateVerificationPaginationQuery,
} from '../validators/verificationValidators.ts';
import { verificationService } from '../services/verificationService.ts';
import { AssetNotFoundError } from '../services/assetService.ts';

export const verificationRouter = Router({ mergeParams: true });

function getSessionActor(req: Request): string {
  return req.session?.username || req.admin?.username || 'admin';
}

/**
 * GET /api/assets/:assetId/verifications/evaluation
 * Evaluates chronological precedence and mixed-precision ambiguity (Policy P11-D01)
 * across ALL qualifying records on the server.
 * Returns server-authoritative evaluation without unbounded client loading.
 */
verificationRouter.get('/evaluation', async (req: Request, res: Response) => {
  const { assetId } = req.params;

  if (!isValidUuid(assetId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed asset ID. Expected standard RFC 4122 UUID format.',
    });
    return;
  }

  try {
    const evaluation = await verificationService.getVerificationEvaluation(assetId);
    res.status(200).json({
      status: 'ok',
      data: evaluation,
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[VerificationRoute] Error evaluating verifications:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to evaluate asset physical verifications.',
    });
  }
});

/**
 * GET /api/assets/:assetId/verifications
 * Retrieves bounded chronological physical verification records for an asset.
 * Enforces validated page/limit pagination (max 100) and deterministic ordering.
 */
verificationRouter.get('/', async (req: Request, res: Response) => {
  const { assetId } = req.params;

  if (!isValidUuid(assetId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed asset ID. Expected standard RFC 4122 UUID format.',
    });
    return;
  }

  const paginationValidation = validateVerificationPaginationQuery(
    req.query as Record<string, unknown>
  );
  if (!paginationValidation.valid) {
    res.status(400).json({
      status: 'error',
      error: paginationValidation.error,
      field: paginationValidation.field,
    });
    return;
  }

  try {
    const result = await verificationService.getVerifications(
      assetId,
      paginationValidation.data
    );
    res.status(200).json({
      status: 'ok',
      data: result.verifications,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[VerificationRoute] Error fetching verifications:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve asset physical verifications.',
    });
  }
});

/**
 * POST /api/assets/:assetId/verifications
 * Records a new physical verification attempt in an atomic transaction.
 * Updates the latest verification summary cache if eligible without regressing chronology.
 */
verificationRouter.post('/', async (req: Request, res: Response) => {
  const { assetId } = req.params;

  if (!isValidUuid(assetId)) {
    res.status(400).json({
      status: 'error',
      error: 'Malformed asset ID. Expected standard RFC 4122 UUID format.',
    });
    return;
  }

  const validation = validateCreateVerificationInput(req.body);
  if (!validation.valid) {
    res.status(400).json({
      status: 'error',
      error: validation.error,
      field: validation.field,
      code: validation.code,
    });
    return;
  }

  const actor = getSessionActor(req);

  try {
    const result = await verificationService.createVerification(
      assetId,
      validation.data,
      actor
    );

    res.status(201).json({
      status: 'ok',
      message: 'Physical verification recorded successfully.',
      data: result.verification,
      latestSummary: result.latestSummary,
      summaryChanged: result.summaryChanged,
      isAmbiguous: result.isAmbiguous ?? false,
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    console.error('[VerificationRoute] Error recording verification:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to record physical verification due to an internal server error.',
    });
  }
});
