import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  isValidUuid,
  validateCreateAssetInput,
  validatePatchAssetInput,
} from '../validators/assetValidators.ts';
import { validateListAssetsQuery } from '../validators/assetListValidators.ts';
import type { FilterGroup } from '../validators/assetListValidators.ts';
import {
  assetService,
  DuplicateIdentifierError,
  AssetNotFoundError,
} from '../services/assetService.ts';
import { transferRouter } from './transfers.ts';
import { verificationRouter } from './verifications.ts';

export const assetRouter = Router();

// Controlled Transfer & eForm Workflow endpoints (Phase P10)
assetRouter.use('/:assetId/transfers', transferRouter);

// Physical Verification & Date Precision endpoints (Phase P11)
assetRouter.use('/:assetId/verifications', verificationRouter);

/**
 * Helper to count total filter rules across nested groups.
 */
function countFilterRules(group?: FilterGroup): number {
  if (!group || !Array.isArray(group.rules)) return 0;
  let count = 0;
  for (const item of group.rules) {
    if ('operator' in item && ('AND' === item.operator || 'OR' === item.operator)) {
      count += countFilterRules(item as FilterGroup);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Helper to derive authenticated administrator username from server session.
 * Never trusts client-supplied actor values.
 */
function getSessionActor(req: Request): string {
  return req.session?.username || req.admin?.username || 'admin';
}

/**
 * GET /api/assets
 * Retrieves a bounded, paginated list of assets with deterministic sorting, global search,
 * and validated AND/OR filter composition.
 * Read-only endpoint; does not require CSRF token.
 */
assetRouter.get('/', async (req: Request, res: Response) => {
  const validation = validateListAssetsQuery(req.query as Record<string, unknown>);
  if (!validation.valid) {
    res.status(400).json({
      status: 'error',
      error: validation.error,
      field: validation.field,
    });
    return;
  }

  try {
    const result = await assetService.listAssets(validation.data);
    res.status(200).json({
      status: 'ok',
      data: result.items,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      sort: {
        sortBy: validation.data.sortBy,
        sortOrder: validation.data.sortOrder,
      },
      filtersApplied: {
        q: validation.data.q,
        filterCount: countFilterRules(validation.data.filters),
      },
    });
  } catch (err: any) {
    console.error('[AssetRoute] List assets error:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve assets',
    });
  }
});

/**
 * POST /api/assets
 * Creates a new Asset and atomically writes an initial AssetAuditEvent.
 */
assetRouter.post('/', async (req: Request, res: Response) => {
  const validation = validateCreateAssetInput(req.body);
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
    const createdAsset = await assetService.createAsset(validation.data, actor);
    res.status(201).json({
      status: 'ok',
      message: 'Asset created successfully',
      data: createdAsset,
    });
  } catch (err: any) {
    if (err instanceof DuplicateIdentifierError) {
      res.status(409).json({
        status: 'error',
        error: err.message,
        field: err.field,
      });
      return;
    }

    console.error('[AssetRoute] Create asset error:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create asset due to an internal server error',
    });
  }
});

/**
 * GET /api/assets/:id
 * Retrieves a single persisted Asset by UUID with current related lookup values.
 */
assetRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    res.status(400).json({
      status: 'error',
      error: "Malformed asset ID. Expected standard UUID format.",
    });
    return;
  }

  try {
    const asset = await assetService.getAssetById(id);
    if (!asset) {
      res.status(404).json({
        status: 'error',
        error: `Asset with ID '${id}' not found.`,
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      data: asset,
    });
  } catch (err: any) {
    console.error('[AssetRoute] Get asset error:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve asset',
    });
  }
});

/**
 * PATCH /api/assets/:id
 * Safely updates general asset fields and writes an audit event in the same transaction.
 * Strictly rejects assignment (P10) and physical verification (P11) modifications.
 */
assetRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    res.status(400).json({
      status: 'error',
      error: "Malformed asset ID. Expected standard UUID format.",
    });
    return;
  }

  const validation = validatePatchAssetInput(req.body);
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
    const result = await assetService.updateAsset(id, validation.data, actor);

    res.status(200).json({
      status: 'ok',
      message: result.changed ? 'Asset updated successfully.' : 'No changes detected. Asset remains unchanged.',
      changed: result.changed,
      data: result.asset,
    });
  } catch (err: any) {
    if (err instanceof AssetNotFoundError) {
      res.status(404).json({
        status: 'error',
        error: err.message,
      });
      return;
    }

    if (err instanceof DuplicateIdentifierError) {
      res.status(409).json({
        status: 'error',
        error: err.message,
        field: err.field,
      });
      return;
    }

    console.error('[AssetRoute] Update asset error:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to update asset',
    });
  }
});

/**
 * GET /api/assets/:id/history
 * Returns immutable chronological audit records for an asset with pagination and latest-five support.
 */
assetRouter.get('/:id/history', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    res.status(400).json({
      status: 'error',
      error: "Malformed asset ID. Expected standard UUID format.",
    });
    return;
  }

  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;

  try {
    const history = await assetService.getAssetHistory(id, { page, limit });
    res.status(200).json({
      status: 'ok',
      data: history.events,
      pagination: {
        total: history.total,
        page: history.page,
        limit: history.limit,
        totalPages: history.totalPages,
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

    console.error('[AssetRoute] Get history error:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve asset history',
    });
  }
});

/**
 * DELETE /api/assets/:id
 * Explicitly prohibited in this phase.
 */
assetRouter.delete('/:id', (_req: Request, res: Response) => {
  res.status(405).json({
    status: 'error',
    error: 'Asset deletion is strictly prohibited in Phase P04.',
  });
});

assetRouter.delete('/', (_req: Request, res: Response) => {
  res.status(405).json({
    status: 'error',
    error: 'Mass/bulk asset deletion is strictly prohibited.',
  });
});
