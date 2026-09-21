export const MIN_PASSWORD_LENGTH = 12;

export function validateNewPassword(password: string, confirmation: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`;
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password)) {
    return '英大文字・英小文字・数字をそれぞれ1文字以上含めてください。';
  }
  if (password !== confirmation) {
    return '確認用パスワードが一致しません。';
  }
  return '';
}
