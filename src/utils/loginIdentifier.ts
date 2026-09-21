const LOGIN_PART_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function normalizeLoginPart(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function isValidLoginPart(value: string): boolean {
  return LOGIN_PART_PATTERN.test(normalizeLoginPart(value));
}

export function createInternalLoginEmail(
  organizationCode: string,
  userId: string,
): string {
  const normalizedOrganizationCode = normalizeLoginPart(organizationCode);
  const normalizedUserId = normalizeLoginPart(userId);

  if (
    !isValidLoginPart(normalizedOrganizationCode) ||
    !isValidLoginPart(normalizedUserId)
  ) {
    throw new Error('invalid-login-identifier');
  }

  return `${normalizedOrganizationCode}__${normalizedUserId}@login.tennis-club.invalid`;
}
