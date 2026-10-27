import type { AppUser, OrganizationId } from '../types';

export function getOrganizationCandidates(user: AppUser): string[] {
  return Array.from(new Set([
    ...(user.organizationIds ?? []),
    user.defaultOrganizationId,
  ].filter(Boolean)));
}

export function selectAvailableOrganization<T extends { organization: { id: OrganizationId } }>(
  available: T[],
  preferredOrganizationId: string | undefined,
  defaultOrganizationId: string,
): T | undefined {
  return available.find(
    ({ organization }) => organization.id === preferredOrganizationId,
  ) ?? available.find(
    ({ organization }) => organization.id === defaultOrganizationId,
  ) ?? available[0];
}
