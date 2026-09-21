import { randomInt } from 'node:crypto';

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const PASSWORD_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

export function normalizeId(value) {
  return value.trim().normalize('NFKC').toLowerCase();
}

export function validateId(value, label) {
  const normalized = normalizeId(value);
  if (!ID_PATTERN.test(normalized)) {
    throw new Error(`${label}は小文字英数字とハイフンの3〜32文字で入力してください。`);
  }
  return normalized;
}

export function createInternalEmail(loginId) {
  return `${validateId(loginId, 'ユーザーID')}@login.tennis-club.invalid`;
}

export function generateTemporaryPassword(length = 20) {
  return Array.from(
    { length },
    () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)],
  ).join('');
}

export function validateAccountRequest(request, expectedLoginId) {
  if (!request || request.status !== 'pending') {
    throw new Error('対象の申請は存在しないか、既に処理されています。');
  }
  const loginId = validateId(request.loginId, 'ユーザーID');
  if (loginId !== expectedLoginId) {
    throw new Error('申請文書のユーザーIDが文書IDと一致しません。');
  }
  const displayName = String(request.displayName ?? '').trim().normalize('NFKC');
  if (!displayName || displayName.length > 80) {
    throw new Error('申請文書の表示名が不正です。');
  }
  if (request.role !== 'member') {
    throw new Error('申請文書のroleはmemberである必要があります。');
  }
  const memberId = validateId(String(request.memberId ?? ''), '部員ID');
  return { loginId, displayName, role: 'member', memberId };
}
