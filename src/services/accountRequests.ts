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
  input: { loginId: string; displayName: string; memberId: string },
): Promise<void> {
  const { loginId, displayName, memberId } = validateAccountRequestInput(
    input.loginId,
    input.displayName,
    input.memberId,
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
      displayName,
      role: 'member',
      status: 'pending',
      requestedBy,
      memberId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
