import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from '../server/app.ts';
import { getServerConfig } from '../server/config/environment.ts';

test('environment configuration provides sensible defaults', () => {
  const config = getServerConfig();
  assert.equal(typeof config.port, 'number');
  assert.ok(config.port > 0);
  assert.equal(typeof config.host, 'string');
  assert.equal(typeof config.nodeEnv, 'string');
});

test('GET /health returns 200 OK and expected diagnostic schema', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'it-asset-management-backend');
    assert.equal(body.phase, 'P01 - Foundation');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.timestamp, 'string');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
