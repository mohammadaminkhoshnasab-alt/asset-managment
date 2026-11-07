import path from 'path';
import express from 'express';
import { createExpressApp } from './server/app.ts';
import { getServerConfig } from './server/config/environment.ts';

export async function bootstrap() {
  const config = getServerConfig();
  const app = createExpressApp();

  if (config.nodeEnv === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In development, mount Vite's dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[IT-Asset-Management] Server listening at http://${config.host}:${config.port}`);
    console.log(`[IT-Asset-Management] Mode: ${config.nodeEnv}`);
    console.log(`[IT-Asset-Management] Health check available at: http://${config.host}:${config.port}/health`);
  });

  return server;
}

// Start if executed directly
bootstrap().catch((err) => {
  console.error('[IT-Asset-Management] Fatal startup error:', err);
  process.exit(1);
});
