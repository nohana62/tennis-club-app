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

export function validateDocumentId(value, label) {
  const documentId = String(value ?? '');
  if (
    !documentId
    || documentId.length > 1500
    || documentId.includes('/')
    || documentId === '.'
    || documentId === '..'
  ) {
    throw new Error(`${label}が不正です。`);
  }
  return documentId;
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

export function validateAccountRequest(request, expectedLoginId, expectedOrganizationId) {
  if (!request || request.status !== 'ownerApproved') {
    throw new Error('対象の申請はowner承認済みではないか、既に処理されています。');
  }
  const loginId = validateId(request.loginId, 'ユーザーID');
  if (loginId !== expectedLoginId) {
    throw new Error('申請文書のユーザーIDが文書IDと一致しません。');
  }
  const organizationId = validateId(request.organizationId, '団体ID');
  if (organizationId !== expectedOrganizationId) {
    throw new Error('申請文書の団体IDが保存先と一致しません。');
  }
  const displayName = String(request.displayName ?? '').trim().normalize('NFKC');
  if (!displayName || displayName.length > 80) {
    throw new Error('申請文書の表示名が不正です。');
  }
  if (!['member', 'admin'].includes(request.role)) {
    throw new Error('申請文書のroleはmemberまたはadminである必要があります。');
  }
  if (!request.ownerApprovedBy) {
    throw new Error('owner承認者が記録されていません。');
  }
  const memberId = request.role === 'member'
    ? validateDocumentId(request.memberId, '部員ID')
    : null;
  return { loginId, organizationId, displayName, role: request.role, memberId };
}
