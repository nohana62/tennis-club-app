import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  createInternalEmail,
  generateTemporaryPassword,
  validateAccountRequest,
  validateId,
} from './admin-utils.mjs';

export async function listPendingAccountRequests(db, organizationIdInput) {
  const organizationId = validateId(organizationIdInput, '団体ID');
  const organization = await db.doc(`organizations/${organizationId}`).get();
  if (!organization.exists || organization.data()?.status !== 'active') {
    throw new Error('有効な団体が見つかりません。');
  }
  const snapshot = await db
    .collection(`organizations/${organizationId}/accountRequests`)
    .where('status', '==', 'pending')
    .get();
  return snapshot.docs
    .map((document) => ({
      id: document.id,
      loginId: document.data().loginId,
      displayName: document.data().displayName,
      createdAt: document.data().createdAt?.toDate?.()?.toISOString() ?? '',
    }))
    .sort((left, right) => left.loginId.localeCompare(right.loginId));
}

export async function approveAccountRequest({
  auth,
  db,
  organizationId: organizationIdInput,
  loginId: loginIdInput,
  approvedBy = 'admin-cli',
  temporaryPassword = generateTemporaryPassword(),
  approvalToken = randomUUID(),
}) {
  const organizationId = validateId(organizationIdInput, '団体ID');
  const loginId = validateId(loginIdInput, 'ユーザーID');
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const requestRef = db.doc(
    `organizations/${organizationId}/accountRequests/${loginId}`,
  );
  const loginIdRef = db.doc(`loginIds/${loginId}`);
  const uid = randomUUID().replaceAll('-', '');
  let authCreated = false;
  let reserved = false;

  try {
    const request = await db.runTransaction(async (transaction) => {
      const [organization, requestSnapshot, loginIdSnapshot] = await Promise.all([
        transaction.get(organizationRef),
        transaction.get(requestRef),
        transaction.get(loginIdRef),
      ]);
      if (!organization.exists || organization.data()?.status !== 'active') {
        throw new Error('有効な団体が見つかりません。');
      }
      if (loginIdSnapshot.exists) {
        throw new Error('同じユーザーIDが既に予約または使用されています。');
      }
      const validated = validateAccountRequest(requestSnapshot.data(), loginId);
      transaction.create(loginIdRef, {
        status: 'reserved',
        organizationId,
        uid,
        approvalToken,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(requestRef, {
        status: 'approving',
        approvalToken,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return validated;
    });
    reserved = true;

    await auth.createUser({
      uid,
      email: createInternalEmail(loginId),
      emailVerified: true,
      password: temporaryPassword,
      displayName: request.displayName,
      disabled: false,
    });
    authCreated = true;

    const batch = db.batch();
    batch.create(db.doc(`users/${uid}`), {
      loginId,
      displayName: request.displayName,
      defaultOrganizationId: organizationId,
      status: 'active',
      passwordChangeRequired: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.create(db.doc(`organizations/${organizationId}/memberships/${uid}`), {
      role: 'member',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(loginIdRef, {
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
      approvalToken: FieldValue.delete(),
    });
    batch.update(requestRef, {
      status: 'approved',
      approvedUid: uid,
      approvedBy,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      approvalToken: FieldValue.delete(),
    });
    await batch.commit();

    return { organizationId, loginId, displayName: request.displayName, uid, temporaryPassword };
  } catch (error) {
    const rollbackErrors = [];
    if (authCreated) {
      try {
        await auth.deleteUser(uid);
      } catch (rollbackError) {
        rollbackErrors.push(`Auth削除: ${rollbackError?.message ?? String(rollbackError)}`);
      }
    }
    if (reserved) {
      try {
        await db.runTransaction(async (transaction) => {
          const [loginIdSnapshot, requestSnapshot] = await Promise.all([
            transaction.get(loginIdRef),
            transaction.get(requestRef),
          ]);
          if (loginIdSnapshot.data()?.approvalToken === approvalToken) {
            transaction.delete(loginIdRef);
          }
          if (requestSnapshot.data()?.approvalToken === approvalToken) {
            transaction.update(requestRef, {
              status: 'pending',
              approvalToken: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        });
      } catch (rollbackError) {
        rollbackErrors.push(`Firestore復旧: ${rollbackError?.message ?? String(rollbackError)}`);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        `${error?.message ?? String(error)}（ロールバックにも失敗: ${rollbackErrors.join(' / ')}）`,
        { cause: error },
      );
    }
    throw error;
  }
}
