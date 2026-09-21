import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type { AppUser, Membership, Organization } from '../types';
import { db, functions } from './firebase';

export async function resolveUserOrganization(uid: string) {
  const userSnapshot = await getDoc(doc(db, 'users', uid));
  if (!userSnapshot.exists()) throw new Error('user-profile-not-found');
  const user = { uid, ...userSnapshot.data() } as AppUser;
  if (user.status !== 'active') {
    throw new Error('user-inactive');
  }
  if (user.passwordChangeRequired) {
    return { user, organization: null, membership: null };
  }
  if (!user.defaultOrganizationId) throw new Error('organization-not-configured');

  const organizationId = user.defaultOrganizationId;
  const [organizationSnapshot, membershipSnapshot] = await Promise.all([
    getDoc(doc(db, 'organizations', organizationId)),
    getDoc(doc(db, 'organizations', organizationId, 'memberships', uid)),
  ]);
  if (!organizationSnapshot.exists() || !membershipSnapshot.exists()) {
    throw new Error('membership-not-found');
  }

  const organization = {
    id: organizationSnapshot.id,
    ...organizationSnapshot.data(),
  } as Organization;
  const membership = { uid, ...membershipSnapshot.data() } as Membership;
  if (organization.status !== 'active' || membership.status !== 'active') {
    throw new Error('membership-inactive');
  }
  if (membership.role === 'member') {
    if (!membership.memberId) throw new Error('member-link-not-found');
    const memberSnapshot = await getDoc(
      doc(db, 'organizations', organizationId, 'members', membership.memberId),
    );
    if (!memberSnapshot.exists()) throw new Error('member-link-not-found');
  }

  return { user, organization, membership };
}

export async function completeRequiredPasswordChange(
  user: User,
  newPassword: string,
): Promise<void> {
  const completePasswordChange = httpsCallable<
    { newPassword: string },
    { completed: true }
  >(functions, 'completeRequiredPasswordChange');
  try {
    await completePasswordChange({ newPassword });
  } catch (error) {
    if (
      !(error instanceof Error)
      || !('code' in error)
      || error.code !== 'functions/failed-precondition'
    ) {
      throw error;
    }
  }
  await user.reload();
}
