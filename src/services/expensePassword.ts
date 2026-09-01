const KEY = 'tennis_club_expense_password';
const DEFAULT_PASSWORD = 'tennis123';

export function getExpensePassword(): string {
  return localStorage.getItem(KEY) ?? DEFAULT_PASSWORD;
}

export function setExpensePassword(newPassword: string): void {
  localStorage.setItem(KEY, newPassword);
}

export function checkExpensePassword(input: string): boolean {
  return input === getExpensePassword();
}
