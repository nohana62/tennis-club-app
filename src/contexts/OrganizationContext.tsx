import { useEffect, useState, type ReactNode } from 'react';
import type { AppUser, Membership, Organization, OrganizationId } from '../types';
import {
  completeRequiredPasswordChange,
  resolveUserOrganization,
  type OrganizationAccess,
} from '../services/organization';
import { IS_DEMO, useAuth } from './auth';
import { OrganizationContext } from './organization';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<OrganizationAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (IS_DEMO || !user) {
      setUserProfile(null);
      setOrganization(null);
      setMembership(null);
      setAvailableOrganizations([]);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    const loadOrganization = async () => {
      setLoading(true);
      setError('');
      try {
        const storedOrganizationId = localStorage.getItem(`activeOrganization:${user.uid}`) ?? undefined;
        const result = await resolveUserOrganization(user.uid, storedOrganizationId);
        if (!active) return;
        setUserProfile(result.user);
        setOrganization(result.organization);
        setMembership(result.membership);
        setAvailableOrganizations(result.availableOrganizations);
        if (result.organization) {
          localStorage.setItem(`activeOrganization:${user.uid}`, result.organization.id);
        }
      } catch {
        if (active) setError('利用できる団体が設定されていません。管理者へ連絡してください。');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOrganization();
    return () => {
      active = false;
    };
  }, [user]);

  const completePasswordChange = async (newPassword: string) => {
    if (!user || !userProfile) {
      throw new Error('user-profile-not-loaded');
    }
    await completeRequiredPasswordChange(user, newPassword);
    const result = await resolveUserOrganization(user.uid);
    setUserProfile(result.user);
    setOrganization(result.organization);
    setMembership(result.membership);
    setAvailableOrganizations(result.availableOrganizations);
  };

  const selectOrganization = (organizationId: OrganizationId) => {
    const selected = availableOrganizations.find(
      (access) => access.organization.id === organizationId,
    );
    if (!selected || !user) throw new Error('organization-not-available');
    localStorage.setItem(`activeOrganization:${user.uid}`, organizationId);
    setOrganization(selected.organization);
    setMembership(selected.membership);
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizationId: IS_DEMO ? 'demo' as OrganizationId : organization?.id ?? null,
        userProfile,
        organization,
        membership,
        availableOrganizations,
        loading,
        error,
        selectOrganization,
        completePasswordChange,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
