import { createContext, useContext } from 'react';
import type { AppUser, Membership, Organization, OrganizationId } from '../types';
import type { OrganizationAccess } from '../services/organization';

export interface OrganizationContextValue {
  organizationId: OrganizationId | null;
  userProfile: AppUser | null;
  organization: Organization | null;
  membership: Membership | null;
  availableOrganizations: OrganizationAccess[];
  loading: boolean;
  error: string;
  selectOrganization: (organizationId: OrganizationId) => void;
  completePasswordChange: (newPassword: string) => Promise<void>;
}

export const OrganizationContext =
  createContext<OrganizationContextValue | null>(null);

export function useOrganization() {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error('useOrganization must be used within OrganizationProvider');
  return value;
}

export function useOrganizationId(): OrganizationId {
  const { organizationId } = useOrganization();
  if (!organizationId) {
    throw new Error('organization-id-not-resolved');
  }
  return organizationId;
}
