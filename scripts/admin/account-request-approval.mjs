import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import {
  createInternalEmail,
  generateTemporaryPassword,
  validateAccountRequest,
  validateId,
} from './admin-utils.mjs';

export async function listProvisionableAccountRequests(db, organizationIdInput) {
  const organizationId = validateId(organizationIdInput, '団体ID');
  const organization = await db.doc(`organizations/${organizationId}`).get();
  if (!organization.exists || organization.data()?.status !== 'active') {
    throw new Error('有効な団体が見つかりません。');
  }
  const snapshot = await db
    .collection(`organizations/${organizationId}/accountRequests`)
    .where('status', '==', 'ownerApproved')
    .get();
  return snapshot.docs
    .map((document) => ({
      id: document.id,
      loginId: document.data().loginId,
      displayName: document.data().displayName,
      role: document.data().role,
      createdAt: document.data().createdAt?.toDate?.()?.toISOString() ?? '',
    }))
    .sort((left, right) => left.loginId.localeCompare(right.loginId));
}

export const listPendingAccountRequests = listProvisionableAccountRequests;

export async function approveAccountRequest({
  auth,
  db,
  organizationId: organizationIdInput,
  loginId: loginIdInput,
  approvedBy = 'admin-cli',
  temporaryPassword = generateTemporaryPassword(),
  approvalToken = randomUUID(),
  recoverInterrupted = false,
}) {
  const organizationId = validateId(organizationIdInput, '団体ID');
  const loginId = validateId(loginIdInput, 'ユーザーID');
  const organizationRef = db.doc(`organizations/${organizationId}`);
  const requestRef = db.doc(
    `organizations/${organizationId}/accountRequests/${loginId}`,
  );
  const loginIdRef = db.doc(`loginIds/${loginId}`);
  const uid = randomUUID().replaceAll('-', '');
  let reserved = false;
  let requestDetails;

  const interrupted = await db.runTransaction(async (transaction) => {
    const [requestSnapshot, loginIdSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(loginIdRef),
    ]);
    const request = requestSnapshot.data();
    const login = loginIdSnapshot.data();
    if (!['provisioning', 'recovering'].includes(request?.status)) return null;
    if (
      login?.status !== 'reserved'
      || login.organizationId !== organizationId
      || login.approvalToken !== request.approvalToken
      || !login.uid
    ) {
      throw new Error('申請とユーザーID予約の状態が不整合です。手動確認が必要です。');
    }
    if (recoverInterrupted) {
      transaction.update(requestRef, {
        status: 'recovering',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { uid: login.uid, approvalToken: login.approvalToken };
  });
  if (interrupted) {
    if (!recoverInterrupted) {
      throw new Error('中断された承認処理があります。状態確認後に--recoverを指定してください。');
    }
    try {
      await auth.deleteUser(interrupted.uid);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw new Error(
          `中断処理のAuth利用者を削除できないため予約を保持しました: ${error?.message ?? String(error)}`,
          { cause: error },
        );
      }
    }
    await db.runTransaction(async (transaction) => {
      const [requestSnapshot, loginIdSnapshot] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(loginIdRef),
      ]);
      if (
        requestSnapshot.data()?.status !== 'recovering'
        || requestSnapshot.data()?.approvalToken !== interrupted.approvalToken
        || loginIdSnapshot.data()?.approvalToken !== interrupted.approvalToken
      ) {
        throw new Error('復旧中に申請状態が変更されました。');
      }
      transaction.delete(loginIdRef);
      transaction.update(requestRef, {
        status: 'ownerApproved',
        approvalToken: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }

  try {
    requestDetails = await db.runTransaction(async (transaction) => {
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
      const validated = validateAccountRequest(
        requestSnapshot.data(),
        loginId,
        organizationId,
      );
      if (validated.role === 'member') {
        const memberSnapshot = await transaction.get(
          db.doc(`organizations/${organizationId}/members/${validated.memberId}`),
        );
        if (!memberSnapshot.exists) {
          throw new Error('申請に紐付く部員が見つかりません。');
        }
      }
      transaction.create(loginIdRef, {
        status: 'reserved',
        organizationId,
        uid,
        approvalToken,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(requestRef, {
        status: 'provisioning',
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
      displayName: requestDetails.displayName,
      disabled: false,
    });

    await db.runTransaction(async (transaction) => {
      const [loginIdSnapshot, requestSnapshot] = await Promise.all([
        transaction.get(loginIdRef),
        transaction.get(requestRef),
      ]);
      if (
        loginIdSnapshot.data()?.status !== 'reserved'
        || loginIdSnapshot.data()?.uid !== uid
        || loginIdSnapshot.data()?.approvalToken !== approvalToken
        || requestSnapshot.data()?.status !== 'provisioning'
        || requestSnapshot.data()?.approvalToken !== approvalToken
      ) {
        throw new Error('承認状態が変更されたため確定できませんでした。');
      }
      transaction.create(db.doc(`users/${uid}`), {
        loginId,
        displayName: requestDetails.displayName,
        defaultOrganizationId: organizationId,
        organizationIds: [organizationId],
        status: 'active',
        passwordChangeRequired: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const membership = {
        role: requestDetails.role,
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (requestDetails.memberId) membership.memberId = requestDetails.memberId;
      transaction.create(
        db.doc(`organizations/${organizationId}/memberships/${uid}`),
        membership,
      );
      transaction.update(loginIdRef, {
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
        approvalToken: FieldValue.delete(),
      });
      transaction.update(requestRef, {
        status: 'provisioned',
        approvedUid: uid,
        provisionedBy: approvedBy,
        provisionedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        approvalToken: FieldValue.delete(),
      });
    });

    return {
      organizationId,
      loginId,
      displayName: requestDetails.displayName,
      role: requestDetails.role,
      uid,
      temporaryPassword,
    };
  } catch (error) {
    const rollbackErrors = [];
    if (reserved) {
      const committed = await db.runTransaction(async (transaction) => {
        const [loginIdSnapshot, requestSnapshot] = await Promise.all([
          transaction.get(loginIdRef),
          transaction.get(requestRef),
        ]);
        return loginIdSnapshot.data()?.status === 'active'
          && loginIdSnapshot.data()?.uid === uid
          && requestSnapshot.data()?.status === 'provisioned'
          && requestSnapshot.data()?.approvedUid === uid;
      });
      if (committed) {
        return {
          organizationId,
          loginId,
          displayName: requestDetails?.displayName ?? '',
          role: requestDetails?.role ?? '',
          uid,
          temporaryPassword,
        };
      }
    }
    if (reserved) {
      try {
        await auth.getUser(uid);
        await auth.deleteUser(uid);
      } catch (rollbackError) {
        if (rollbackError?.code !== 'auth/user-not-found') {
          throw new Error(
            `${error?.message ?? String(error)}（Auth削除を確認できないため予約を保持しました: `
            + `${rollbackError?.message ?? String(rollbackError)}）`,
            { cause: error },
          );
        }
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
              status: 'ownerApproved',
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
