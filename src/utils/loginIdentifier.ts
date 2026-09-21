const LOGIN_PART_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function normalizeLoginPart(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function isValidLoginPart(value: string): boolean {
  return LOGIN_PART_PATTERN.test(normalizeLoginPart(value));
}

export function createInternalLoginEmail(userId: string): string {
  const normalizedUserId = normalizeLoginPart(userId);

  if (!isValidLoginPart(normalizedUserId)) {
    throw new Error('invalid-login-identifier');
  }

  return `${normalizedUserId}@login.tennis-club.invalid`;
}
