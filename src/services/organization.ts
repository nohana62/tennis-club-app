import { doc, getDoc } from 'firebase/firestore';
import type { AppUser, Membership, Organization } from '../types';
import { db } from './firebase';

export async function resolveUserOrganization(uid: string) {
  const userSnapshot = await getDoc(doc(db, 'users', uid));
  if (!userSnapshot.exists()) throw new Error('user-profile-not-found');
  const user = { uid, ...userSnapshot.data() } as AppUser;
  if (user.status !== 'active' || !user.defaultOrganizationId) {
    throw new Error('user-inactive');
  }

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

  return { user, organization, membership };
}
