import assert from 'node:assert/strict';
import test from 'node:test';
import { approveAccountRequest } from './account-request-approval.mjs';
import { validateAccountRequest } from './admin-utils.mjs';

class FakeSnapshot {
  constructor(value) {
    this.value = value;
    this.exists = value !== undefined;
  }

  data() {
    return this.value;
  }
}

class FakeDb {
  constructor(entries, failBatch = false) {
    this.entries = new Map(Object.entries(entries));
    this.failBatch = failBatch;
  }

  doc(path) {
    return { path };
  }

  async runTransaction(callback) {
    const transaction = {
      get: async (ref) => new FakeSnapshot(this.entries.get(ref.path)),
      create: (ref, value) => {
        if (this.entries.has(ref.path)) throw new Error('already-exists');
        this.entries.set(ref.path, value);
      },
      update: (ref, value) => {
        this.entries.set(ref.path, { ...this.entries.get(ref.path), ...value });
      },
      delete: (ref) => this.entries.delete(ref.path),
    };
    return callback(transaction);
  }

  batch() {
    const writes = [];
    return {
      create: (ref, value) => writes.push(['create', ref.path, value]),
      update: (ref, value) => writes.push(['update', ref.path, value]),
      commit: async () => {
        if (this.failBatch) throw new Error('batch-failed');
        for (const [kind, path, value] of writes) {
          if (kind === 'create' && this.entries.has(path)) throw new Error('already-exists');
          this.entries.set(path, { ...this.entries.get(path), ...value });
        }
      },
    };
  }
}

function createPendingDb(failBatch = false) {
  return new FakeDb({
    'organizations/club-a': { status: 'active' },
    'organizations/club-a/accountRequests/member-one': {
      loginId: 'member-one',
      displayName: 'Member One',
      role: 'member',
      status: 'pending',
    },
  }, failBatch);
}

test('validates safe member-only requests', () => {
  assert.deepEqual(validateAccountRequest({
    loginId: 'member-one',
    displayName: ' Member One ',
    role: 'member',
    status: 'pending',
  }, 'member-one'), {
    loginId: 'member-one',
    displayName: 'Member One',
    role: 'member',
  });
  assert.throws(
    () => validateAccountRequest({
      loginId: 'member-one',
      displayName: 'Member One',
      role: 'owner',
      status: 'pending',
    }, 'member-one'),
    /roleはmember/,
  );
});

test('approves a request exactly once and creates member records', async () => {
  const db = createPendingDb();
  const createdUsers = [];
  const auth = {
    createUser: async (user) => createdUsers.push(user),
    deleteUser: async () => assert.fail('must not roll back a successful approval'),
  };
  const result = await approveAccountRequest({
    auth,
    db,
    organizationId: 'club-a',
    loginId: 'member-one',
    temporaryPassword: 'TemporaryPass123!',
    approvalToken: 'approval-1',
  });
  assert.equal(result.temporaryPassword, 'TemporaryPass123!');
  assert.equal(createdUsers.length, 1);
  assert.equal(db.entries.get('users/' + result.uid).passwordChangeRequired, true);
  assert.equal(
    db.entries.get(`organizations/club-a/memberships/${result.uid}`).role,
    'member',
  );
  assert.equal(
    db.entries.get('organizations/club-a/accountRequests/member-one').status,
    'approved',
  );
  await assert.rejects(
    approveAccountRequest({
      auth,
      db,
      organizationId: 'club-a',
      loginId: 'member-one',
      temporaryPassword: 'AnotherPass123!',
    }),
    /予約または使用/,
  );
});

test('rolls back Auth and the reservation when the final batch fails', async () => {
  const db = createPendingDb(true);
  const deletedUsers = [];
  const auth = {
    createUser: async () => {},
    deleteUser: async (uid) => deletedUsers.push(uid),
  };
  await assert.rejects(
    approveAccountRequest({
      auth,
      db,
      organizationId: 'club-a',
      loginId: 'member-one',
      temporaryPassword: 'TemporaryPass123!',
      approvalToken: 'approval-rollback',
    }),
    /batch-failed/,
  );
  assert.equal(deletedUsers.length, 1);
  assert.equal(db.entries.has('loginIds/member-one'), false);
  assert.equal(
    db.entries.get('organizations/club-a/accountRequests/member-one').status,
    'pending',
  );
});
