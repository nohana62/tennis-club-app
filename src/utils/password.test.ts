import { describe, expect, test } from 'vitest';
import { validateNewPassword } from './password';
import { validateAccountRequestInput } from './loginIdentifier';

describe('validateNewPassword', () => {
  test('accepts any matching password with at least six characters', () => {
    expect(validateNewPassword('123456', '123456')).toBe('');
    expect(validateNewPassword('あいうえおか', 'あいうえおか')).toBe('');
  });

  describe('validateAccountRequestInput', () => {
    test('normalizes a valid login ID and display name', () => {
      expect(validateAccountRequestInput('  New-Member ', '　山田 太郎　', 'member-1')).toEqual({
        loginId: 'new-member',
        displayName: '山田 太郎',
        memberId: 'member-1',
      });
    });

    test.each(['ab', 'invalid_id', '-invalid', 'invalid-'])(
      'rejects invalid login ID %s',
      (loginId) => {
        expect(() => validateAccountRequestInput(loginId, '利用者', 'member-1')).toThrow('3〜32文字');
      },
    );

    test('rejects an empty display name', () => {
      expect(() => validateAccountRequestInput('valid-id', '　', 'member-1')).toThrow('表示名');
    });

    test('requires a member link', () => {
      expect(() => validateAccountRequestInput('valid-id', '利用者', '')).toThrow('部員');
    });
  });

  test.each([
    ['12345', '12345', '6文字以上'],
    ['SecurePass123', 'SecurePass124', '一致しません'],
  ])('rejects invalid input', (password, confirmation, expected) => {
    expect(validateNewPassword(password, confirmation)).toContain(expected);
  });
});
