import assert from 'node:assert/strict';
import test from 'node:test';
import { linkOwnerToOrganization } from './owner-organization-link.mjs';

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
  constructor(entries) {
    this.entries = new Map(Object.entries(entries));
  }

  doc(path) {
    return { path };
  }

  async runTransaction(callback) {
    const staged = new Map(this.entries);
    const transaction = {
      get: async (ref) => new FakeSnapshot(staged.get(ref.path)),
      create: (ref, value) => {
        if (staged.has(ref.path)) throw new Error('already-exists');
        staged.set(ref.path, value);
      },
      update: (ref, value) => staged.set(ref.path, {
        ...staged.get(ref.path),
        ...value,
      }),
    };
    const result = await callback(transaction);
    this.entries = staged;
    return result;
  }
}

function createDb() {
  return new FakeDb({
    'loginIds/owner-one': { status: 'active', uid: 'owner-uid' },
    'users/owner-uid': {
      status: 'active',
      defaultOrganizationId: 'club-a',
      organizationIds: ['club-a'],
    },
    'organizations/club-b': { status: 'active' },
  });
}

test('links an existing owner to another organization idempotently', async () => {
  const db = createDb();
  const first = await linkOwnerToOrganization({
    db,
    loginId: 'owner-one',
    organizationId: 'club-b',
  });
  assert.equal(first.alreadyLinked, false);
  assert.equal(
    db.entries.get('organizations/club-b/memberships/owner-uid').role,
    'owner',
  );
  assert.deepEqual(
    db.entries.get('users/owner-uid').organizationIds,
    ['club-a', 'club-b'],
  );

  const second = await linkOwnerToOrganization({
    db,
    loginId: 'owner-one',
    organizationId: 'club-b',
  });
  assert.equal(second.alreadyLinked, true);
  assert.deepEqual(
    db.entries.get('users/owner-uid').organizationIds,
    ['club-a', 'club-b'],
  );
});

test('refuses to replace a non-owner membership', async () => {
  const db = createDb();
  db.entries.set(
    'organizations/club-b/memberships/owner-uid',
    { role: 'admin', status: 'active' },
  );
  await assert.rejects(
    linkOwnerToOrganization({
      db,
      loginId: 'owner-one',
      organizationId: 'club-b',
    }),
    /owner以外/,
  );
});
