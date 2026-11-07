import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from '../server/app.ts';

test('P04 Endpoints: Unauthenticated POST /api/assets returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'Test Model' }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P04 Endpoints: Unauthenticated GET /api/assets/:id returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/123e4567-e89b-12d3-a456-426614174000`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P04 Endpoints: Unauthenticated GET /api/assets/:id/history returns 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/123e4567-e89b-12d3-a456-426614174000/history`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P04 Endpoints: DELETE /api/assets/:id returns 405 Method Not Allowed', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/assets/123e4567-e89b-12d3-a456-426614174000`, {
      method: 'DELETE',
    });
    // Even if unauthenticated or authenticated, DELETE must be rejected with 401 or 405
    assert.ok(res.status === 401 || res.status === 405);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P04 Endpoints: Unauthenticated lookups and people endpoints return 401 Unauthorized', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const [resTypes, resLocs, resHealth, resPeople] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/api/lookups/asset-types`),
      fetch(`http://127.0.0.1:${port}/api/lookups/locations`),
      fetch(`http://127.0.0.1:${port}/api/lookups/device-health`),
      fetch(`http://127.0.0.1:${port}/api/people`),
    ]);

    assert.equal(resTypes.status, 401);
    assert.equal(resLocs.status, 401);
    assert.equal(resHealth.status, 401);
    assert.equal(resPeople.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P04 Endpoints: Existing /health endpoint remains functional and unauthenticated', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
