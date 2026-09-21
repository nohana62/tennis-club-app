import { useEffect, useState, type ReactNode } from 'react';
import type { AppUser, Membership, Organization } from '../types';
import { resolveUserOrganization } from '../services/organization';
import { IS_DEMO, useAuth } from './auth';
import { OrganizationContext } from './organization';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (IS_DEMO || !user) {
      return;
    }
    let active = true;
    const loadOrganization = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await resolveUserOrganization(user.uid);
        if (!active) return;
        setUserProfile(result.user);
        setOrganization(result.organization);
        setMembership(result.membership);
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

  return (
    <OrganizationContext.Provider
      value={{ userProfile, organization, membership, loading, error }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}
