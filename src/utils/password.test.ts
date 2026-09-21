import { describe, expect, test } from 'vitest';
import { validateNewPassword } from './password';

describe('validateNewPassword', () => {
  test('accepts a matching password with the required character classes', () => {
    expect(validateNewPassword('SecurePass123', 'SecurePass123')).toBe('');
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
