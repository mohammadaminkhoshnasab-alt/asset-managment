import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  validateUsername,
  validatePasswordStrength,
} from '../server/auth/password.ts';

test('P03 Password Security: hashPassword generates mature Argon2id format ($argon2id$)', async () => {
  const plain = 'SuperSecret123!';
  const hash = await hashPassword(plain);

  assert.equal(typeof hash, 'string');
  assert.ok(hash.startsWith('$argon2id$'), 'Hash must use Argon2id algorithm identifier');
  assert.notEqual(hash, plain, 'Hash must never match plaintext');
  assert.ok(!hash.includes(plain), 'Hash must not leak plaintext password');
});

test('P03 Password Security: verifyPassword validates correct and incorrect candidates', async () => {
  const plain = 'CorrectAdminPassword456';
  const hash = await hashPassword(plain);

  const isValid = await verifyPassword(hash, plain);
  assert.equal(isValid, true, 'Correct password must verify successfully');

  const isInvalid = await verifyPassword(hash, 'WrongPassword789');
  assert.equal(isInvalid, false, 'Incorrect password must be rejected');

  const isInvalidEmpty = await verifyPassword(hash, '');
  assert.equal(isInvalidEmpty, false, 'Empty candidate must be rejected');

  const isCorruptedHash = await verifyPassword('$argon2id$invalid_corrupted_hash', plain);
  assert.equal(isCorruptedHash, false, 'Corrupted hash must safely return false without crashing');
});

test('P03 Password Security: validateUsername enforces character set and length', () => {
  assert.equal(validateUsername('admin').valid, true);
  assert.equal(validateUsername('it_lead.01').valid, true);

  // Too short (< 3 chars)
  const shortResult = validateUsername('ad');
  assert.equal(shortResult.valid, false);
  assert.ok(shortResult.error?.includes('between 3 and 32'));

  // Invalid characters (spaces, special punctuation)
  const invalidCharResult = validateUsername('admin user@corp');
  assert.equal(invalidCharResult.valid, false);

  // Non-string
  assert.equal(validateUsername(null).valid, false);
  assert.equal(validateUsername(12345).valid, false);
});

test('P03 Password Security: validatePasswordStrength enforces minimum 10 characters', () => {
  assert.equal(validatePasswordStrength('short9ch!').valid, false);
  assert.equal(validatePasswordStrength('10charpass').valid, true);
  assert.equal(validatePasswordStrength('LongerSecureAdminPass#2026').valid, true);

  // Non-string
  assert.equal(validatePasswordStrength(undefined).valid, false);
});
