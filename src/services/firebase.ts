import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { ClubEvent, Member, Attendance, Expense } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let db: Firestore;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.error('Firebase 初期化エラー:', e);
  throw e;
}

// ── Events ──────────────────────────────────────────

export async function getEvents(): Promise<ClubEvent[]> {
  const q = query(collection(db, 'events'), orderBy('date'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubEvent));
}

export async function addEvent(event: Omit<ClubEvent, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'events'), {
    ...event,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateEvent(id: string, event: Partial<ClubEvent>): Promise<void> {
  await updateDoc(doc(db, 'events', id), event as Record<string, unknown>);
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, 'events', id));
}

// ── Members ─────────────────────────────────────────

export async function getMembers(): Promise<Member[]> {
  const q = query(collection(db, 'members'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member));
}

export async function addMember(member: Omit<Member, 'id'>): Promise<string> {
  // 既存部員の最大orderを取得して +1
  const snap = await getDocs(collection(db, 'members'));
  const maxOrder = snap.docs.reduce((max, d) => {
    const o = (d.data() as Member).order ?? 0;
    return o > max ? o : max;
  }, -1);
  const ref = await addDoc(collection(db, 'members'), {
    ...member,
    order: maxOrder + 1,
    joinedAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateMember(id: string, member: Partial<Member>): Promise<void> {
  await updateDoc(doc(db, 'members', id), member as Record<string, unknown>);
}

export async function deleteMember(id: string): Promise<void> {
  await deleteDoc(doc(db, 'members', id));
}

// ── Attendance ──────────────────────────────────────

export async function getAttendances(): Promise<Attendance[]> {
  const snap = await getDocs(collection(db, 'attendances'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
}

export async function setAttendance(attendance: Omit<Attendance, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'attendances'), {
    ...attendance,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateAttendance(id: string, data: Partial<Attendance>): Promise<void> {
  await updateDoc(doc(db, 'attendances', id), {
    ...data,
    updatedAt: Timestamp.now().toDate().toISOString(),
  } as Record<string, unknown>);
}

// ── Expenses ─────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'expenses'), {
    ...expense,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
  await updateDoc(doc(db, 'expenses', id), expense as Record<string, unknown>);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', id));
}
