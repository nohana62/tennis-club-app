import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { completePasswordChange } from './password-change.js';

initializeApp();
const STAGING_PROJECT_ID = 'tennis-club-app-staging';

export const completeRequiredPasswordChange = onCall(
  { region: 'asia-northeast1' },
  async (request) => {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId !== STAGING_PROJECT_ID) {
      throw new HttpsError('failed-precondition', 'staging以外では実行できません。');
    }
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'ログインが必要です。');
    }
    try {
      await completePasswordChange({
        uid: request.auth.uid,
        newPassword: request.data?.newPassword,
        auth: getAuth(),
        db: getFirestore(),
        timestamp: FieldValue.serverTimestamp,
      });
      return { completed: true };
    } catch (error) {
      if (error?.message === 'password-change-not-required') {
        throw new HttpsError('failed-precondition', 'パスワード変更は不要です。');
      }
      if (error?.code === 'auth/weak-password') {
        throw new HttpsError('invalid-argument', 'パスワードが要件を満たしていません。');
      }
      if (
        error instanceof Error
        && error.message.includes('6文字')
      ) {
        throw new HttpsError('invalid-argument', error.message);
      }
      console.error('Required password change failed', {
        uid: request.auth.uid,
        code: error?.code ?? 'unknown',
      });
      throw new HttpsError('internal', 'パスワードを変更できませんでした。');
    }
  },
);
