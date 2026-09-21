import assert from 'node:assert/strict';
import test from 'node:test';
import { completePasswordChange, validatePassword } from './password-change.js';

test('validates the server-side password policy', () => {
  assert.doesNotThrow(() => validatePassword('123456'));
  assert.doesNotThrow(() => validatePassword('あいうえおか'));
  assert.throws(() => validatePassword('12345'), /6文字/);
});

test('updates Auth before clearing the required-change flag', async () => {
  const calls = [];
  const user = {
    passwordChangeRequired: true,
    updatedAt: null,
  };
  await completePasswordChange({
    uid: 'user-1',
    newPassword: 'SecurePass123',
    auth: {
      updateUser: async (uid, change) => calls.push(['auth', uid, change.password]),
    },
    db: {
      doc: () => ({
        get: async () => ({ exists: true, data: () => user }),
        update: async (change) => {
          calls.push(['firestore']);
          Object.assign(user, change);
        },
      }),
    },
    timestamp: () => 'server-time',
  });
  assert.deepEqual(calls, [
    ['auth', 'user-1', 'SecurePass123'],
    ['firestore'],
  ]);
  assert.equal(user.passwordChangeRequired, false);
});

test('does not update Auth when the change is not required', async () => {
  let authCalled = false;
  await assert.rejects(completePasswordChange({
    uid: 'user-1',
    newPassword: 'SecurePass123',
    auth: {
      updateUser: async () => {
        authCalled = true;
      },
    },
    db: {
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ passwordChangeRequired: false }),
        }),
      }),
    },
    timestamp: () => 'server-time',
  }), /not-required/);
  assert.equal(authCalled, false);
});
