import { Router } from 'express';
import type { Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'it-asset-management-backend',
    phase: 'P01 - Foundation',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
