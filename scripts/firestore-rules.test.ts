import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, test } from 'vitest';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'tennis-club-app-staging',
    firestore: {
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const seed = [
      ['users/owner-a', {
        loginId: 'owner-a',
        displayName: 'Owner A',
        defaultOrganizationId: 'club-a',
        status: 'active',
        passwordChangeRequired: false,
      }],
      ['users/forced-a', {
        loginId: 'forced-a',
        displayName: 'Forced A',
        defaultOrganizationId: 'club-a',
        status: 'active',
        passwordChangeRequired: true,
      }],
      ['users/admin-a', {
        loginId: 'admin-a',
        displayName: 'Admin A',
        defaultOrganizationId: 'club-a',
        status: 'active',
        passwordChangeRequired: false,
      }],
      ['users/member-a', {
        loginId: 'member-a',
        displayName: 'Member A',
        defaultOrganizationId: 'club-a',
        status: 'active',
        passwordChangeRequired: false,
      }],
      ['users/suspended-a', {
        loginId: 'suspended-a',
        displayName: 'Suspended A',
        defaultOrganizationId: 'club-a',
        status: 'suspended',
        passwordChangeRequired: false,
      }],
      ['users/owner-b', {
        loginId: 'owner-b',
        displayName: 'Owner B',
        defaultOrganizationId: 'club-b',
        status: 'active',
        passwordChangeRequired: false,
      }],
      ['organizations/club-a', { name: 'Club A', status: 'active' }],
      ['organizations/club-b', { name: 'Club B', status: 'active' }],
      ['organizations/club-a/memberships/owner-a', { role: 'owner', status: 'active' }],
      ['organizations/club-a/memberships/forced-a', { role: 'member', status: 'active' }],
      ['organizations/club-a/memberships/admin-a', { role: 'admin', status: 'active' }],
      ['organizations/club-a/memberships/member-a', {
        role: 'member',
        status: 'active',
        memberId: 'member-record-a',
      }],
      ['organizations/club-a/memberships/suspended-a', {
        role: 'member',
        status: 'suspended',
        memberId: 'suspended-record-a',
      }],
      ['organizations/club-b/memberships/owner-b', { role: 'owner', status: 'active' }],
      ['organizations/club-a/events/event-a', { title: 'A' }],
      ['organizations/club-a/members/member-record-a', { name: 'Member A' }],
      ['organizations/club-b/events/event-b', { title: 'B' }],
      ['organizations/club-a/posts/post-a', {
        authorName: 'Member A',
        content: 'post',
        important: false,
        createdBy: 'member-a',
        createdAt: new Date().toISOString(),
      }],
      ['loginIds/reserved-id', { status: 'reserved' }],
    ];
    await Promise.all(seed.map(([path, value]) => setDoc(doc(db, path), value)));
  });
});

afterAll(async () => {
  await environment.cleanup();
});

describe('Firestore tenant rules', () => {
  test('allows only the signed-in user to read and safely clear the password flag', async () => {
    const forcedDb = environment.authenticatedContext('forced-a').firestore();
    await assertSucceeds(getDoc(doc(forcedDb, 'users/forced-a')));
    await assertFails(getDoc(doc(forcedDb, 'users/member-a')));
    await assertFails(getDoc(doc(forcedDb, 'organizations/club-a/events/event-a')));
    await assertFails(updateDoc(doc(forcedDb, 'users/forced-a'), {
      passwordChangeRequired: false,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(forcedDb, 'users/forced-a'), {
      defaultOrganizationId: 'club-b',
    }));
  });

  test('enforces tenant boundaries and suspended-user denial', async () => {
    const ownerA = environment.authenticatedContext('owner-a').firestore();
    const ownerB = environment.authenticatedContext('owner-b').firestore();
    const suspended = environment.authenticatedContext('suspended-a').firestore();
    await assertSucceeds(getDoc(doc(ownerA, 'organizations/club-a/events/event-a')));
    await assertFails(getDoc(doc(ownerA, 'organizations/club-b/events/event-b')));
    await assertSucceeds(getDoc(doc(ownerB, 'organizations/club-b/events/event-b')));
    await assertFails(getDoc(doc(suspended, 'organizations/club-a/events/event-a')));
  });

  test('enforces role-specific writes', async () => {
    const admin = environment.authenticatedContext('admin-a').firestore();
    const member = environment.authenticatedContext('member-a').firestore();
    await assertSucceeds(addDoc(collection(admin, 'organizations/club-a/events'), {
      title: 'Manager event',
    }));
    await assertFails(addDoc(collection(member, 'organizations/club-a/events'), {
      title: 'Member event',
    }));
    await assertSucceeds(addDoc(collection(member, 'organizations/club-a/attendances'), {
      eventId: 'event-a',
      memberId: 'member-record-a',
      memberName: 'Member A',
      status: 'attending',
    }));
    await assertFails(addDoc(collection(member, 'organizations/club-a/attendances'), {
      eventId: 'event-a',
      memberId: 'someone-else',
      memberName: 'Other',
      status: 'attending',
    }));
  });

  test('allows managers to create member requests but never approve them', async () => {
    const owner = environment.authenticatedContext('owner-a').firestore();
    const member = environment.authenticatedContext('member-a').firestore();
    const request = {
      loginId: 'new-member',
      displayName: 'New Member',
      role: 'member',
      status: 'pending',
      requestedBy: 'owner-a',
      memberId: 'member-record-a',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(
      doc(owner, 'organizations/club-a/accountRequests/new-member'),
      request,
    ));
    await assertFails(setDoc(
      doc(member, 'organizations/club-a/accountRequests/member-request'),
      { ...request, loginId: 'member-request', requestedBy: 'member-a' },
    ));
    await assertFails(setDoc(
      doc(owner, 'organizations/club-a/accountRequests/reserved-id'),
      { ...request, loginId: 'reserved-id' },
    ));
    await assertFails(updateDoc(
      doc(owner, 'organizations/club-a/accountRequests/new-member'),
      { status: 'approved' },
    ));
    await assertFails(getDoc(doc(owner, 'loginIds/reserved-id')));
  });

  test('allows members to create and delete only their own posts', async () => {
    const member = environment.authenticatedContext('member-a').firestore();
    const created = doc(collection(member, 'organizations/club-a/posts'));
    await assertSucceeds(setDoc(created, {
      authorName: 'Member A',
      content: 'hello',
      important: false,
      createdBy: 'member-a',
      createdAt: new Date().toISOString(),
    }));
    await assertSucceeds(deleteDoc(created));
    await assertFails(deleteDoc(doc(member, 'organizations/club-a/posts/post-a')));
  });
});
