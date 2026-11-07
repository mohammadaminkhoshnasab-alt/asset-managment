import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from '../server/app.ts';

test('P08 Endpoints: Unauthenticated GET /api/assets returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P08 Endpoints: Unauthenticated GET /api/assets with query params still returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets?q=Laptop&page=1&pageSize=25`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
