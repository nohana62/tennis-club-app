import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { updatePassword, type User } from 'firebase/auth';
import type {
  AppUser,
  Membership,
  Organization,
  OrganizationId,
} from '../types';
import {
  getOrganizationCandidates,
  selectAvailableOrganization,
} from '../utils/organizationSelection';
import { db } from './firebase';

export interface OrganizationAccess {
  organization: Organization;
  membership: Membership;
}

async function resolveOrganizationAccess(
  uid: string,
  organizationId: string,
): Promise<OrganizationAccess | null> {
  try {
    const [organizationSnapshot, membershipSnapshot] = await Promise.all([
      getDoc(doc(db, 'organizations', organizationId)),
      getDoc(doc(db, 'organizations', organizationId, 'memberships', uid)),
    ]);
    if (!organizationSnapshot.exists() || !membershipSnapshot.exists()) return null;

    const organization = {
      id: organizationSnapshot.id as OrganizationId,
      ...organizationSnapshot.data(),
    } as Organization;
    const membership = { uid, ...membershipSnapshot.data() } as Membership;
    if (organization.status !== 'active' || membership.status !== 'active') return null;
    if (membership.role === 'member') {
      if (!membership.memberId) return null;
      const memberSnapshot = await getDoc(
        doc(db, 'organizations', organizationId, 'members', membership.memberId),
      );
      if (!memberSnapshot.exists()) return null;
    }
    return { organization, membership };
  } catch {
    return null;
  }
}

export async function resolveUserOrganization(uid: string, preferredOrganizationId?: string) {
  const userSnapshot = await getDoc(doc(db, 'users', uid));
  if (!userSnapshot.exists()) throw new Error('user-profile-not-found');
  const user = { uid, ...userSnapshot.data() } as AppUser;
  if (user.status !== 'active') {
    throw new Error('user-inactive');
  }
  if (user.passwordChangeRequired) {
    return { user, organization: null, membership: null, availableOrganizations: [] };
  }
  if (!user.defaultOrganizationId) throw new Error('organization-not-configured');

  const resolved = await Promise.all(
    getOrganizationCandidates(user).map((organizationId) =>
      resolveOrganizationAccess(uid, organizationId)),
  );
  const availableOrganizations = resolved.filter(
    (access): access is OrganizationAccess => access !== null,
  );
  if (availableOrganizations.length === 0) throw new Error('membership-not-found');
  const active = selectAvailableOrganization(
    availableOrganizations,
    preferredOrganizationId,
    user.defaultOrganizationId,
  );
  if (!active) throw new Error('membership-not-found');

  return {
    user,
    organization: active.organization,
    membership: active.membership,
    availableOrganizations,
  };
}

export async function completeRequiredPasswordChange(
  user: User,
  newPassword: string,
): Promise<void> {
  await updatePassword(user, newPassword);
  await updateDoc(doc(db, 'users', user.uid), {
    passwordChangeRequired: false,
    updatedAt: serverTimestamp(),
  });
}
