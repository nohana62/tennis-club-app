import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { AccountRequest } from '../types';
import { validateAccountRequestInput } from '../utils/loginIdentifier';
import { db } from './firebase';

export async function getAccountRequests(
  organizationId: string,
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
  organizationId: string,
  requestedBy: string,
  input: { loginId: string; displayName: string },
): Promise<void> {
  const { loginId, displayName } = validateAccountRequestInput(
    input.loginId,
    input.displayName,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
