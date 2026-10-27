import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { AccountRequest, OrganizationId } from '../types';
import { validateAccountRequestInput } from '../utils/loginIdentifier';
import { db } from './firebase';

export async function getAccountRequests(
  organizationId: OrganizationId,
): Promise<AccountRequest[]> {
  const snapshot = await getDocs(query(
    collection(db, 'organizations', organizationId, 'accountRequests'),
    orderBy('createdAt', 'desc'),
  ));
  return snapshot.docs.map((request) => ({
    id: request.id,
    ...request.data(),
  } as AccountRequest));
}

export async function createAccountRequest(
  organizationId: OrganizationId,
  requestedBy: string,
  input: {
    loginId: string;
    displayName: string;
    role: 'member' | 'admin';
    memberId?: string | null;
  },
): Promise<void> {
  const { loginId, displayName, role, memberId } = validateAccountRequestInput(
    input.loginId,
    input.displayName,
    input.role,
    input.memberId ?? undefined,
  );
  const requestRef = doc(
    db,
    'organizations',
    organizationId,
    'accountRequests',
    loginId,
  );

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(requestRef);
    if (existing.exists()) {
      throw new Error('account-request-already-exists');
    }
    transaction.set(requestRef, {
      loginId,
      organizationId,
      displayName,
      role,
      status: 'pending',
      requestedBy,
      memberId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function reviewAccountRequest(
  organizationId: OrganizationId,
  requestId: string,
  reviewedBy: string,
  decision: 'approve' | 'reject',
  role: 'member' | 'admin',
): Promise<void> {
  const requestRef = doc(
    db,
    'organizations',
    organizationId,
    'accountRequests',
    requestId,
  );
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(requestRef);
    if (!snapshot.exists() || snapshot.data().status !== 'pending') {
      throw new Error('account-request-already-reviewed');
    }
    const request = snapshot.data() as AccountRequest;
    if (decision === 'approve' && role === 'member' && !request.memberId) {
      throw new Error('member-link-required');
    }
    transaction.update(requestRef, decision === 'approve'
      ? {
          organizationId,
          role,
          status: 'ownerApproved',
          ownerApprovedBy: reviewedBy,
          ownerApprovedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      : {
          organizationId,
          status: 'rejected',
          rejectedBy: reviewedBy,
          rejectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
  });
}
