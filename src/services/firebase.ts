import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFunctions, type Functions } from 'firebase/functions';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  onSnapshot,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import type { ClubEvent, Member, Attendance, Expense, Post, DoublesSchedule, StoredDoublesMatch } from '../types';
import { isValidDoublesGames } from '../utils/doublesResults';
import { createGenerationId } from '../utils/ids';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export let db: Firestore;
export let auth: Auth;
export let functions: Functions;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  functions = getFunctions(app, 'asia-northeast1');
} catch (e) {
  console.error('Firebase 初期化エラー:', e);
  throw e;
}

function organizationCollection(organizationId: string, collectionName: string) {
  if (!organizationId) throw new Error('organization-id-required');
  return collection(db, 'organizations', organizationId, collectionName);
}

function organizationDocument(
  organizationId: string,
  collectionName: string,
  documentId: string,
) {
  if (!organizationId) throw new Error('organization-id-required');
  return doc(db, 'organizations', organizationId, collectionName, documentId);
}

// ── Events ──────────────────────────────────────────

export async function getEvents(organizationId: string): Promise<ClubEvent[]> {
  const q = query(organizationCollection(organizationId, 'events'), orderBy('date'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClubEvent));
}

export async function addEvent(organizationId: string, event: Omit<ClubEvent, 'id'>): Promise<string> {
  const ref = await addDoc(organizationCollection(organizationId, 'events'), {
    ...event,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateEvent(organizationId: string, id: string, event: Partial<ClubEvent>): Promise<void> {
  await updateDoc(organizationDocument(organizationId, 'events', id), event as Record<string, unknown>);
}

export async function deleteEvent(organizationId: string, id: string): Promise<void> {
  await deleteDoc(organizationDocument(organizationId, 'events', id));
}

// ── Members ─────────────────────────────────────────

export async function getMembers(organizationId: string): Promise<Member[]> {
  const q = query(organizationCollection(organizationId, 'members'), orderBy('order'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member));
}

export async function addMember(organizationId: string, member: Omit<Member, 'id'>): Promise<string> {
  // 既存部員の最大orderを取得して +1
  const snap = await getDocs(organizationCollection(organizationId, 'members'));
  const maxOrder = snap.docs.reduce((max, d) => {
    const o = (d.data() as Member).order ?? 0;
    return o > max ? o : max;
  }, -1);
  const ref = await addDoc(organizationCollection(organizationId, 'members'), {
    ...member,
    order: maxOrder + 1,
    joinedAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateMember(organizationId: string, id: string, member: Partial<Member>): Promise<void> {
  await updateDoc(organizationDocument(organizationId, 'members', id), member as Record<string, unknown>);
}

export async function deleteMember(organizationId: string, id: string): Promise<void> {
  await deleteDoc(organizationDocument(organizationId, 'members', id));
}

// ── Attendance ──────────────────────────────────────

export async function getAttendances(organizationId: string): Promise<Attendance[]> {
  const snap = await getDocs(organizationCollection(organizationId, 'attendances'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
}

export async function setAttendance(organizationId: string, attendance: Omit<Attendance, 'id'>): Promise<string> {
  const ref = await addDoc(organizationCollection(organizationId, 'attendances'), {
    ...attendance,
    updatedAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateAttendance(organizationId: string, id: string, data: Partial<Attendance>): Promise<void> {
  await updateDoc(organizationDocument(organizationId, 'attendances', id), {
    ...data,
    updatedAt: Timestamp.now().toDate().toISOString(),
  } as Record<string, unknown>);
}

// ── Doubles schedules ───────────────────────────────

export function subscribeDoublesSchedule(
  organizationId: string,
  eventId: string,
  onData: (schedule: DoublesSchedule | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    organizationDocument(organizationId, 'doublesSchedules', eventId),
    (snapshot) => {
      onData(snapshot.exists() ? snapshot.data() as DoublesSchedule : null);
    },
    onError,
  );
}

export async function createDoublesSchedule(
  organizationId: string,
  eventId: string,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> {
  const ref = organizationDocument(organizationId, 'doublesSchedules', eventId);
  const generationId = createGenerationId();
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) return false;
    const now = Timestamp.now().toDate().toISOString();
    transaction.set(ref, {
      eventId,
      generationId,
      revision: 0,
      matches,
      participantCount,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });
}

export async function replaceDoublesSchedule(
  organizationId: string,
  eventId: string,
  expectedGenerationId: string,
  expectedRevision: number,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> {
  const ref = organizationDocument(organizationId, 'doublesSchedules', eventId);
  const generationId = createGenerationId();
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return false;
    const current = snapshot.data() as DoublesSchedule;
    if (
      current.generationId !== expectedGenerationId
      || current.revision !== expectedRevision
    ) return false;
    const now = Timestamp.now().toDate().toISOString();
    transaction.set(ref, {
      eventId,
      generationId,
      revision: 0,
      matches,
      participantCount,
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });
}

export async function setDoublesMatchCompleted(
  organizationId: string,
  eventId: string,
  expectedGenerationId: string,
  matchNumber: number,
  completed: boolean,
): Promise<boolean> {
  const ref = organizationDocument(organizationId, 'doublesSchedules', eventId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return false;
    const schedule = snapshot.data() as DoublesSchedule;
    if (schedule.generationId !== expectedGenerationId) return false;
    const matches = schedule.matches.map((match) => (
      match.number === matchNumber ? { ...match, completed } : match
    ));
    if (!matches.some((match) => match.number === matchNumber)) {
      throw new Error('対象の試合が見つかりません。');
    }
    transaction.update(ref, {
      matches,
      revision: (schedule.revision ?? 0) + 1,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
    return true;
  });
}

export async function saveDoublesMatchScore(
  organizationId: string,
  eventId: string,
  expectedGenerationId: string,
  matchNumber: number,
  expectedScoreRevision: number,
  teamAGames: number,
  teamBGames: number,
): Promise<boolean> {
  if (!isValidDoublesGames(teamAGames) || !isValidDoublesGames(teamBGames)) {
    throw new Error('取得ゲーム数は0～99の整数で指定してください。');
  }
  const ref = organizationDocument(organizationId, 'doublesSchedules', eventId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return false;
    const schedule = snapshot.data() as DoublesSchedule;
    if (schedule.generationId !== expectedGenerationId) return false;
    const target = schedule.matches.find((match) => match.number === matchNumber);
    if (!target || (target.scoreRevision ?? 0) !== expectedScoreRevision) return false;
    const matches = schedule.matches.map((match) => (
      match.number === matchNumber
        ? {
            ...match,
            teamAGames,
            teamBGames,
            completed: true,
            scoreRevision: (match.scoreRevision ?? 0) + 1,
          }
        : match
    ));
    transaction.update(ref, {
      matches,
      revision: (schedule.revision ?? 0) + 1,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
    return true;
  });
}

// ── Expenses ─────────────────────────────────────────

export async function getExpenses(organizationId: string): Promise<Expense[]> {
  const q = query(organizationCollection(organizationId, 'expenses'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

export async function addExpense(organizationId: string, expense: Omit<Expense, 'id'>): Promise<string> {
  const ref = await addDoc(organizationCollection(organizationId, 'expenses'), {
    ...expense,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function updateExpense(organizationId: string, id: string, expense: Partial<Expense>): Promise<void> {
  await updateDoc(organizationDocument(organizationId, 'expenses', id), expense as Record<string, unknown>);
}

export async function deleteExpense(organizationId: string, id: string): Promise<void> {
  await deleteDoc(organizationDocument(organizationId, 'expenses', id));
}

// ── App Config (shared settings) ────────────────────

export interface AppConfig {
  expensePassword: string;
  teamsWebhookUrl: string;
  lineToken: string;
  lineGroupId: string;
}

const CONFIG_DOC = 'appConfig';
const DEFAULT_CONFIG: AppConfig = {
  expensePassword: 'tennis123',
  teamsWebhookUrl: '',
  lineToken: '',
  lineGroupId: '',
};

export async function getAppConfig(organizationId: string): Promise<AppConfig> {
  const ref = organizationDocument(organizationId, 'settings', CONFIG_DOC);
  const snap = await getDoc(ref);
  if (snap.exists()) return { ...DEFAULT_CONFIG, ...snap.data() } as AppConfig;
  return { ...DEFAULT_CONFIG };
}

export async function saveAppConfig(organizationId: string, data: Partial<AppConfig>): Promise<void> {
  const ref = organizationDocument(organizationId, 'settings', CONFIG_DOC);
  await setDoc(ref, data, { merge: true });
}

// ── Posts (掲示板) ──────────────────────────────────

export async function getPosts(organizationId: string): Promise<Post[]> {
  const q = query(organizationCollection(organizationId, 'posts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function addPost(organizationId: string, post: Omit<Post, 'id'>): Promise<string> {
  const ref = await addDoc(organizationCollection(organizationId, 'posts'), {
    ...post,
    createdAt: Timestamp.now().toDate().toISOString(),
  });
  return ref.id;
}

export async function deletePost(organizationId: string, id: string): Promise<void> {
  await deleteDoc(organizationDocument(organizationId, 'posts', id));
}
