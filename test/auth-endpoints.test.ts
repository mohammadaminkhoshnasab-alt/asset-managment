import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createExpressApp } from '../server/app.ts';
import { isAccountLocked } from '../server/auth/rateLimiter.ts';

test('P03 Endpoints: Health check remains 200 OK after mounting authentication system', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'it-asset-management-backend');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Endpoints: Public registration is explicitly blocked (404 Not Found)', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hacker', password: 'Password123!' }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error?.includes('Public registration is not supported'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Endpoints: GET /api/auth/me returns 401 Unauthorized when unauthenticated', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.status, 'error');
    assert.ok(body.error?.includes('Authentication required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Endpoints: GET /api/auth/csrf generates and returns a valid 64-character token', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/csrf`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.csrfToken, 'string');
    assert.equal(body.csrfToken.length, 64);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Endpoints: POST /api/auth/login validates input types and rejects empty credentials', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error?.includes('Username and password are required'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Endpoints: POST /api/auth/logout destroys session and clears session cookie', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, {
      method: 'POST',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');

    // Cookie clearance header
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie?.includes('it_asset_sess=;'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Security: CSRF protection blocks state-changing requests with mismatched origin', async () => {
  const app = createExpressApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-phishing-site.example.com',
      },
      body: JSON.stringify({ username: 'admin', password: 'Password123!' }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error?.includes('Cross-origin request blocked by CSRF policy'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('P03 Security: Account Lockout calculator detects active lock and remaining time', () => {
  // Not locked
  assert.equal(isAccountLocked({ lockedUntil: null }).locked, false);

  // Expired lock in the past
  const pastLock = new Date(Date.now() - 60000);
  assert.equal(isAccountLocked({ lockedUntil: pastLock }).locked, false);

  // Active lock in the future
  const futureLock = new Date(Date.now() + 10 * 60 * 1000);
  const activeLockResult = isAccountLocked({ lockedUntil: futureLock });
  assert.equal(activeLockResult.locked, true);
  assert.ok((activeLockResult.remainingMinutes || 0) >= 9);
});
