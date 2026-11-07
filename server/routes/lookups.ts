import { Router } from 'express';
import type { Request, Response } from 'express';
import { lookupService } from '../services/lookupService.ts';

export const lookupRouter = Router();
export const peopleRouter = Router();

/**
 * GET /api/lookups/asset-types
 * Returns active asset classification types.
 */
lookupRouter.get('/asset-types', async (_req: Request, res: Response) => {
  try {
    const types = await lookupService.getAssetTypes();
    res.status(200).json({
      status: 'ok',
      data: types,
    });
  } catch (err: any) {
    console.error('[LookupRoute] Error fetching asset types:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve asset types',
    });
  }
});

/**
 * GET /api/lookups/locations
 * Returns active physical locations.
 */
lookupRouter.get('/locations', async (_req: Request, res: Response) => {
  try {
    const locations = await lookupService.getLocations();
    res.status(200).json({
      status: 'ok',
      data: locations,
    });
  } catch (err: any) {
    console.error('[LookupRoute] Error fetching locations:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve locations',
    });
  }
});

/**
 * GET /api/lookups/device-health
 * Returns active device health classification statuses.
 */
lookupRouter.get('/device-health', async (_req: Request, res: Response) => {
  try {
    const healthStatuses = await lookupService.getDeviceHealthStatuses();
    res.status(200).json({
      status: 'ok',
      data: healthStatuses,
    });
  } catch (err: any) {
    console.error('[LookupRoute] Error fetching device health statuses:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve device health statuses',
    });
  }
});

/**
 * GET /api/people
 * Minimal People search/lookup for initial asset assignment.
 */
peopleRouter.get('/', async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const limit = parseInt(req.query.limit as string, 10) || 50;

  try {
    const people = await lookupService.getPeople({ search, limit });
    res.status(200).json({
      status: 'ok',
      data: people,
    });
  } catch (err: any) {
    console.error('[PeopleRoute] Error fetching people:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve people',
    });
  }
});

/**
 * POST /api/people
 * Minimal Person creation for asset ownership without building full people-management.
 * Enforces explicit unique IDs and rejects duplicate usernames or personal codes.
 */
peopleRouter.post('/', async (req: Request, res: Response) => {
  const { fullName, personalCode, username, department, costCenter, email } = req.body || {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    res.status(400).json({
      status: 'error',
      error: "Field 'fullName' is required and must be a non-empty string.",
      field: 'fullName',
    });
    return;
  }

  try {
    const person = await lookupService.createPerson({
      fullName,
      personalCode,
      username,
      department,
      costCenter,
      email,
    });

    res.status(201).json({
      status: 'ok',
      message: 'Person record created successfully',
      data: person,
    });
  } catch (err: any) {
    // Unique constraint violations (P2002 on username or personal_code)
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '');
      res.status(409).json({
        status: 'error',
        error: `Unique constraint violated on field: ${target}`,
      });
      return;
    }

    console.error('[PeopleRoute] Error creating person:', err.message);
    res.status(500).json({
      status: 'error',
      error: 'Failed to create person record',
    });
  }
});
