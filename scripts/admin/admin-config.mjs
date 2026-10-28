import { readFile } from 'node:fs/promises';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export const STAGING_PROJECT_ID = 'tennis-club-app-staging';

export async function initializeAdmin() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALSが設定されていません。');
  }

  const serviceAccount = JSON.parse(await readFile(credentialPath, 'utf8'));
  if (serviceAccount.project_id !== STAGING_PROJECT_ID) {
    throw new Error(
      `開発用以外のプロジェクトは拒否しました: ${String(serviceAccount.project_id)}`,
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(serviceAccount),
      projectId: STAGING_PROJECT_ID,
    });

  return {
    projectId: STAGING_PROJECT_ID,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
