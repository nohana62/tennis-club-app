import { FieldValue } from 'firebase-admin/firestore';
import { validateId } from './admin-utils.mjs';

export async function linkOwnerToOrganization({
  db,
  loginId: loginIdInput,
  organizationId: organizationIdInput,
}) {
  const loginId = validateId(loginIdInput, 'ユーザーID');
  const organizationId = validateId(organizationIdInput, '団体ID');
  const loginRef = db.doc(`loginIds/${loginId}`);
  const organizationRef = db.doc(`organizations/${organizationId}`);

  return db.runTransaction(async (transaction) => {
    const [loginSnapshot, organizationSnapshot] = await Promise.all([
      transaction.get(loginRef),
      transaction.get(organizationRef),
    ]);
    const login = loginSnapshot.data();
    if (!loginSnapshot.exists || login?.status !== 'active' || !login.uid) {
      throw new Error('有効なユーザーIDが見つかりません。');
    }
    if (!organizationSnapshot.exists || organizationSnapshot.data()?.status !== 'active') {
      throw new Error('有効な団体が見つかりません。');
    }

    const userRef = db.doc(`users/${login.uid}`);
    const membershipRef = db.doc(
      `organizations/${organizationId}/memberships/${login.uid}`,
    );
    const [userSnapshot, membershipSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(membershipRef),
    ]);
    const user = userSnapshot.data();
    if (!userSnapshot.exists || user?.status !== 'active') {
      throw new Error('有効な利用者プロフィールが見つかりません。');
    }
    if (
      membershipSnapshot.exists
      && (membershipSnapshot.data()?.role !== 'owner'
        || membershipSnapshot.data()?.status !== 'active')
    ) {
      throw new Error('対象団体にowner以外または停止中のmembershipが既にあります。');
    }

    const organizationIds = Array.from(new Set([
      ...(Array.isArray(user.organizationIds) ? user.organizationIds : []),
      user.defaultOrganizationId,
      organizationId,
    ].filter(Boolean)));
    transaction.update(userRef, {
      organizationIds,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (!membershipSnapshot.exists) {
      transaction.create(membershipRef, {
        role: 'owner',
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      uid: login.uid,
      loginId,
      organizationId,
      alreadyLinked: membershipSnapshot.exists,
    };
  });
}
