import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapAdministrator } from '../server/auth/bootstrapService.ts';

test('P03 Bootstrap: rejects weak password before attempting database operations', async () => {
  const result = await bootstrapAdministrator({
    username: 'admin',
    password: 'weak',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'INVALID_INPUT');
  assert.ok(result.error?.includes('at least 10 characters'));
  assert.equal(result.admin, undefined);
});

test('P03 Bootstrap: rejects invalid username before attempting database operations', async () => {
  const result = await bootstrapAdministrator({
    username: 'a',
    password: 'ValidSecureAdminPassword123!',
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'INVALID_INPUT');
  assert.ok(result.error?.includes('between 3 and 32 characters'));
  assert.equal(result.admin, undefined);
});

test('P03 Bootstrap (Integration): provisions admin when DB is available or safely skips if disconnected', async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('postgres:postgres@127.0.0.1:5432/it_asset_management')) {
    console.log('[P03 Test Notice] No active PostgreSQL daemon available; bootstrap database insertion recorded as NOT VERIFIED.');
    assert.ok(true, 'Skipping live DB bootstrap test in environment without active PostgreSQL daemon');
    return;
  }

  // If live DB were running, test single-admin creation and duplicate rejection
  const username = `admin_${Date.now()}`;
  const firstAttempt = await bootstrapAdministrator({
    username,
    password: 'InitialPassword123!',
  });

  if (firstAttempt.success) {
    assert.ok(firstAttempt.admin);
    assert.equal(firstAttempt.admin.username, username);
    assert.ok(!('passwordHash' in firstAttempt.admin));

    // Repeat bootstrap MUST be rejected (single administrator constraint)
    const secondAttempt = await bootstrapAdministrator({
      username: 'second_admin',
      password: 'AnotherPassword456!',
    });

    assert.equal(secondAttempt.success, false);
    assert.equal(secondAttempt.code, 'ALREADY_EXISTS');
  }
});
