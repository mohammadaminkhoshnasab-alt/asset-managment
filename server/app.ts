import express from 'express';
import type { Express } from 'express';
import session from 'express-session';
import { getServerConfig } from './config/environment.ts';
import { PrismaSessionStore } from './auth/sessionStore.ts';
import { csrfProtection } from './middleware/csrf.ts';
import { healthRouter } from './routes/health.ts';
import { authRouter } from './routes/auth.ts';
import { assetRouter } from './routes/assets.ts';
import { lookupRouter, peopleRouter } from './routes/lookups.ts';
import { requireAdmin } from './middleware/requireAdmin.ts';
import { errorHandler } from './middleware/errorHandler.ts';

export function createExpressApp(): Express {
  const config = getServerConfig();
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session configuration with PostgreSQL persistence
  app.use(
    session({
      name: 'it_asset_sess',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new PrismaSessionStore(),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      },
    })
  );

  // CSRF protection for state-changing endpoints
  app.use(csrfProtection);

  // Health endpoint (accessible at /health and /api/health for convenience)
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // Authentication endpoints (public login, csrf, session management)
  app.use('/api/auth', authRouter);

  // Core Asset Management and Reference APIs (strictly protected behind requireAdmin)
  app.use('/api/assets', requireAdmin, assetRouter);
  app.use('/api/lookups', requireAdmin, lookupRouter);
  app.use('/api/people', requireAdmin, peopleRouter);

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
