import { describe, expect, test } from 'vitest';
import type { AppUser, OrganizationId } from '../types';
import {
  getOrganizationCandidates,
  selectAvailableOrganization,
} from './organizationSelection';

const user: AppUser = {
  uid: 'owner',
  loginId: 'owner-one',
  displayName: 'Owner',
  defaultOrganizationId: 'club-a',
  organizationIds: ['club-a', 'club-b', 'club-b'],
  status: 'active',
};

describe('organization selection', () => {
  test('deduplicates indexed organizations and keeps the default fallback', () => {
    expect(getOrganizationCandidates(user)).toEqual(['club-a', 'club-b']);
    expect(getOrganizationCandidates({
      ...user,
      organizationIds: undefined,
    })).toEqual(['club-a']);
  });

  test('uses a valid preference and falls back from an unavailable preference', () => {
    const available = [
      { organization: { id: 'club-a' as OrganizationId } },
      { organization: { id: 'club-b' as OrganizationId } },
    ];
    expect(selectAvailableOrganization(available, 'club-b', 'club-a'))
      .toBe(available[1]);
    expect(selectAvailableOrganization(available, 'suspended-club', 'club-a'))
      .toBe(available[0]);
  });
});
