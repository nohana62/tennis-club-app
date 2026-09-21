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
