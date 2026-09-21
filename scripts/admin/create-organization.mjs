import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from './admin-config.mjs';
import {
  createInternalEmail,
  generateTemporaryPassword,
  validateId,
} from './admin-utils.mjs';

const prompt = createInterface({ input, output });
let createdUid;
let reservedLoginId;

try {
  const organizationId = validateId(
    await prompt.question('団体ID（小文字英数字・ハイフン）: '),
    '団体ID',
  );
  const organizationName = (await prompt.question('団体名: ')).trim();
  const loginId = validateId(
    await prompt.question('ownerの希望ユーザーID: '),
    'ユーザーID',
  );
  const displayName = (await prompt.question('ownerの表示名: ')).trim();
  if (!organizationName || !displayName) {
    throw new Error('団体名と表示名は必須です。');
  }
  const confirmation = await prompt.question(
    `開発用に「${organizationName}」とowner「${displayName}」を作成します。CREATEと入力: `,
  );
  if (confirmation !== 'CREATE') throw new Error('作成を中止しました。');

  const { projectId, auth, db } = await initializeAdmin();
  console.log(`接続先: ${projectId}`);

  const organizationRef = db.doc(`organizations/${organizationId}`);
  const loginIdRef = db.doc(`loginIds/${loginId}`);
  await db.runTransaction(async (transaction) => {
    const [organization, login] = await Promise.all([
      transaction.get(organizationRef),
      transaction.get(loginIdRef),
    ]);
    if (organization.exists) throw new Error('同じ団体IDが既に存在します。');
    if (login.exists) throw new Error('同じユーザーIDが既に使用されています。');
    transaction.create(loginIdRef, {
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  reservedLoginId = loginId;

  const temporaryPassword = generateTemporaryPassword();
  const authUser = await auth.createUser({
    email: createInternalEmail(loginId),
    emailVerified: true,
    password: temporaryPassword,
    displayName,
    disabled: false,
  });
  createdUid = authUser.uid;

  const batch = db.batch();
  batch.create(organizationRef, {
    name: organizationName,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(db.doc(`users/${createdUid}`), {
    loginId,
    displayName,
    defaultOrganizationId: organizationId,
    status: 'active',
    passwordChangeRequired: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(
    db.doc(`organizations/${organizationId}/memberships/${createdUid}`),
    {
      role: 'owner',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  );
  batch.update(loginIdRef, {
    uid: createdUid,
    status: 'active',
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  console.log('団体とownerを作成しました。');
  console.log(`団体ID: ${organizationId}`);
  console.log(`ユーザーID: ${loginId}`);
  console.log(`一時パスワード（再表示不可）: ${temporaryPassword}`);
} catch (error) {
  try {
    const { auth, db } = await initializeAdmin();
    if (createdUid) await auth.deleteUser(createdUid);
    if (reservedLoginId) await db.doc(`loginIds/${reservedLoginId}`).delete();
  } catch (rollbackError) {
    console.error(`ロールバック失敗: ${rollbackError?.message ?? String(rollbackError)}`);
  }
  console.error(`団体作成失敗: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
