import { describe, expect, test } from 'vitest';
import { validateNewPassword } from './password';
import { validateAccountRequestInput } from './loginIdentifier';

describe('validateNewPassword', () => {
  test('accepts a matching password with the required character classes', () => {
    expect(validateNewPassword('SecurePass123', 'SecurePass123')).toBe('');
  });

  describe('validateAccountRequestInput', () => {
    test('normalizes a valid login ID and display name', () => {
      expect(validateAccountRequestInput('  New-Member ', '　山田 太郎　')).toEqual({
        loginId: 'new-member',
        displayName: '山田 太郎',
      });
    });

    test.each(['ab', 'invalid_id', '-invalid', 'invalid-'])(
      'rejects invalid login ID %s',
      (loginId) => {
        expect(() => validateAccountRequestInput(loginId, '利用者')).toThrow('3〜32文字');
      },
    );

    test('rejects an empty display name', () => {
      expect(() => validateAccountRequestInput('valid-id', '　')).toThrow('表示名');
    });
  });

  test.each([
    ['Short1A', 'Short1A', '12文字以上'],
    ['alllowercase123', 'alllowercase123', '英大文字'],
    ['ALLUPPERCASE123', 'ALLUPPERCASE123', '英大文字'],
    ['NoNumbersHere', 'NoNumbersHere', '英大文字'],
    ['SecurePass123', 'SecurePass124', '一致しません'],
  ])('rejects invalid input', (password, confirmation, expected) => {
    expect(validateNewPassword(password, confirmation)).toContain(expected);
  });
});
