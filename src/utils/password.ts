export const MIN_PASSWORD_LENGTH = 6;

export function validateNewPassword(password: string, confirmation: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`;
  }
  if (password !== confirmation) {
    return '確認用パスワードが一致しません。';
  }
  return '';
}
