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

export interface NormalizedAccountRequestInput {
  loginId: string;
  displayName: string;
}

export function validateAccountRequestInput(
  loginId: string,
  displayName: string,
): NormalizedAccountRequestInput {
  const normalizedLoginId = normalizeLoginPart(loginId);
  const normalizedDisplayName = displayName.trim().normalize('NFKC');
  if (!isValidLoginPart(normalizedLoginId)) {
    throw new Error('ユーザーIDは小文字英数字とハイフンの3〜32文字で入力してください。');
  }
  if (normalizedDisplayName.length < 1 || normalizedDisplayName.length > 80) {
    throw new Error('表示名は1〜80文字で入力してください。');
  }
  return { loginId: normalizedLoginId, displayName: normalizedDisplayName };
}
