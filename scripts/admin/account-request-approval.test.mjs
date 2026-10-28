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
    const original = this.entries;
    const staged = new Map(this.entries);
    let finalApprovalWrite = false;
    const transaction = {
      get: async (ref) => new FakeSnapshot(staged.get(ref.path)),
      create: (ref, value) => {
        if (staged.has(ref.path)) throw new Error('already-exists');
        staged.set(ref.path, value);
        if (ref.path.startsWith('users/')) finalApprovalWrite = true;
      },
      update: (ref, value) => {
        staged.set(ref.path, { ...staged.get(ref.path), ...value });
      },
      delete: (ref) => staged.delete(ref.path),
    };
    const result = await callback(transaction);
    if (this.failBatch && finalApprovalWrite) {
      this.entries = original;
      throw new Error('batch-failed');
    }
    this.entries = staged;
    return result;
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
      organizationId: 'club-a',
      loginId: 'member-one',
      displayName: 'Member One',
      memberId: 'AbCdEfGhIjKlMnOpQrSt',
      role: 'member',
      status: 'ownerApproved',
      ownerApprovedBy: 'owner-a',
    },
    'organizations/club-a/members/AbCdEfGhIjKlMnOpQrSt': { name: 'Member One' },
  }, failBatch);
}

test('validates owner-approved member and admin requests', () => {
  assert.deepEqual(validateAccountRequest({
    organizationId: 'club-a',
    loginId: 'member-one',
    displayName: ' Member One ',
    memberId: 'AbCdEfGhIjKlMnOpQrSt',
    role: 'member',
    status: 'ownerApproved',
    ownerApprovedBy: 'owner-a',
  }, 'member-one', 'club-a'), {
    loginId: 'member-one',
    organizationId: 'club-a',
    displayName: 'Member One',
    memberId: 'AbCdEfGhIjKlMnOpQrSt',
    role: 'member',
  });
  assert.throws(
    () => validateAccountRequest({
      organizationId: 'club-a',
      loginId: 'member-one',
      displayName: 'Member One',
      memberId: 'AbCdEfGhIjKlMnOpQrSt',
      role: 'owner',
      status: 'ownerApproved',
      ownerApprovedBy: 'owner-a',
    }, 'member-one', 'club-a'),
    /memberまたはadmin/,
  );
  assert.equal(validateAccountRequest({
    organizationId: 'club-a',
    loginId: 'admin-one',
    displayName: 'Admin One',
    memberId: null,
    role: 'admin',
    status: 'ownerApproved',
    ownerApprovedBy: 'owner-a',
  }, 'admin-one', 'club-a').memberId, null);
});

test('approves a request exactly once and creates member records', async () => {
  const db = createPendingDb();
  const createdUsers = [];
  const auth = {
    createUser: async (user) => createdUsers.push(user),
    getUser: async () => assert.fail('must not roll back a successful approval'),
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
    db.entries.get(`organizations/club-a/memberships/${result.uid}`).memberId,
    'AbCdEfGhIjKlMnOpQrSt',
  );
  assert.equal(
    db.entries.get('organizations/club-a/accountRequests/member-one').status,
    'provisioned',
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

test('provisions an owner-approved admin without a member link', async () => {
  const db = createPendingDb();
  db.entries.delete('organizations/club-a/accountRequests/member-one');
  db.entries.set('organizations/club-a/accountRequests/admin-one', {
    organizationId: 'club-a',
    loginId: 'admin-one',
    displayName: 'Admin One',
    memberId: null,
    role: 'admin',
    status: 'ownerApproved',
    ownerApprovedBy: 'owner-a',
  });
  const auth = {
    createUser: async () => {},
    getUser: async () => assert.fail('must not roll back a successful provision'),
    deleteUser: async () => assert.fail('must not roll back a successful provision'),
  };
  const result = await approveAccountRequest({
    auth,
    db,
    organizationId: 'club-a',
    loginId: 'admin-one',
    temporaryPassword: 'TemporaryPass123!',
    approvalToken: 'approval-admin',
  });
  const membership = db.entries.get(
    `organizations/club-a/memberships/${result.uid}`,
  );
  assert.equal(result.role, 'admin');
  assert.equal(membership.role, 'admin');
  assert.equal('memberId' in membership, false);
  assert.deepEqual(db.entries.get(`users/${result.uid}`).organizationIds, ['club-a']);
});

test('rolls back Auth and the reservation when the final batch fails', async () => {
  const db = createPendingDb(true);
  const deletedUsers = [];
  let createdUid;
  const auth = {
    createUser: async (user) => {
      createdUid = user.uid;
    },
    getUser: async (uid) => {
      if (uid !== createdUid) {
        const error = new Error('not-found');
        error.code = 'auth/user-not-found';
        throw error;
      }
      return { uid };
    },
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
    'ownerApproved',
  );
});

test('retains the reservation when Auth rollback cannot be confirmed', async () => {
  const db = createPendingDb(true);
  const auth = {
    createUser: async () => {},
    getUser: async () => ({ uid: 'created-user' }),
    deleteUser: async () => {
      throw new Error('auth-delete-failed');
    },
  };
  await assert.rejects(
    approveAccountRequest({
      auth,
      db,
      organizationId: 'club-a',
      loginId: 'member-one',
      temporaryPassword: 'TemporaryPass123!',
      approvalToken: 'approval-retained',
    }),
    /予約を保持/,
  );
  assert.equal(db.entries.get('loginIds/member-one').status, 'reserved');
  assert.equal(
    db.entries.get('organizations/club-a/accountRequests/member-one').status,
    'provisioning',
  );
});

test('requires an explicit recovery and claims it before replacing interrupted Auth', async () => {
  const db = createPendingDb();
  db.entries.set('organizations/club-a/accountRequests/member-one', {
    ...db.entries.get('organizations/club-a/accountRequests/member-one'),
    status: 'provisioning',
    approvalToken: 'old-token',
  });
  db.entries.set('loginIds/member-one', {
    status: 'reserved',
    organizationId: 'club-a',
    uid: 'old-uid',
    approvalToken: 'old-token',
  });
  const deletedUsers = [];
  const auth = {
    createUser: async () => {},
    getUser: async () => ({ uid: 'unused' }),
    deleteUser: async (uid) => deletedUsers.push(uid),
  };

  await assert.rejects(
    approveAccountRequest({
      auth,
      db,
      organizationId: 'club-a',
      loginId: 'member-one',
      temporaryPassword: 'TemporaryPass123!',
    }),
    /--recover/,
  );

  const result = await approveAccountRequest({
    auth,
    db,
    organizationId: 'club-a',
    loginId: 'member-one',
    temporaryPassword: 'TemporaryPass123!',
    approvalToken: 'new-token',
    recoverInterrupted: true,
  });
  assert.deepEqual(deletedUsers, ['old-uid']);
  assert.equal(
    db.entries.get('organizations/club-a/accountRequests/member-one').approvedUid,
    result.uid,
  );
});
