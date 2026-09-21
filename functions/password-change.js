export const MIN_PASSWORD_LENGTH = 12;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`);
  }
  if (!/[a-z]/u.test(password) || !/[A-Z]/u.test(password) || !/\d/u.test(password)) {
    throw new Error('英大文字・英小文字・数字をそれぞれ1文字以上含めてください。');
  }
}

export async function completePasswordChange({ uid, newPassword, auth, db, timestamp }) {
  validatePassword(newPassword);
  const userRef = db.doc(`users/${uid}`);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists || userSnapshot.data()?.passwordChangeRequired !== true) {
    throw new Error('password-change-not-required');
  }

  await auth.updateUser(uid, { password: newPassword });
  await userRef.update({
    passwordChangeRequired: false,
    updatedAt: timestamp(),
  });
}
