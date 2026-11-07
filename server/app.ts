import express from 'express';
import type { Express } from 'express';
import { healthRouter } from './routes/health.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export function createExpressApp(): Express {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health endpoint (accessible at /health and /api/health for convenience)
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
