import { createContext, useContext } from 'react';
import type { AppUser, Membership, Organization } from '../types';

export interface OrganizationContextValue {
  userProfile: AppUser | null;
  organization: Organization | null;
  membership: Membership | null;
  loading: boolean;
  error: string;
  completePasswordChange: (newPassword: string) => Promise<void>;
}

export const OrganizationContext =
  createContext<OrganizationContextValue | null>(null);

export function useOrganization() {
  const value = useContext(OrganizationContext);
  if (!value) throw new Error('useOrganization must be used within OrganizationProvider');
  return value;
}
