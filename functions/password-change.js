export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`新しいパスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`);
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
