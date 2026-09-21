/**
 * デモモード用モックサービス
 * Firebase の代わりにメモリ内データを使用します。
 * データはページリロードでリセットされます。
 */
import { MOCK_MEMBERS, MOCK_EVENTS, MOCK_ATTENDANCES, MOCK_EXPENSES } from './mockData';
import type {
  ClubEvent,
  Member,
  Attendance,
  Expense,
  Post,
  DoublesSchedule,
  StoredDoublesMatch,
} from '../types';
import { isValidDoublesGames } from '../utils/doublesResults';
import { createGenerationId } from '../utils/ids';

// メモリ内ストア（コピーして書き込み可能にする）
let events: ClubEvent[] = structuredClone(MOCK_EVENTS);
let members: Member[] = structuredClone(MOCK_MEMBERS);
let attendances: Attendance[] = structuredClone(MOCK_ATTENDANCES);
let expenses: Expense[] = structuredClone(MOCK_EXPENSES);
const doublesSchedules = new Map<string, DoublesSchedule>();
const doublesListeners = new Map<string, Set<(schedule: DoublesSchedule | null) => void>>();

let nextId = 100;
const genId = () => `mock-${nextId++}`;

// ── Events ──────────────────────────────────────────

export async function getEvents(_organizationId: string): Promise<ClubEvent[]> {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

export async function addEvent(_organizationId: string, event: Omit<ClubEvent, 'id'>): Promise<string> {
  const id = genId();
  events.push({ ...event, id, createdAt: new Date().toISOString() });
  return id;
}

export async function updateEvent(_organizationId: string, id: string, data: Partial<ClubEvent>): Promise<void> {
  events = events.map((e) => (e.id === id ? { ...e, ...data } : e));
}

export async function deleteEvent(_organizationId: string, id: string): Promise<void> {
  events = events.filter((e) => e.id !== id);
}

// ── Members ─────────────────────────────────────────

export async function getMembers(_organizationId: string): Promise<Member[]> {
  return [...members].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function addMember(_organizationId: string, member: Omit<Member, 'id'>): Promise<string> {
  const id = genId();
  const maxOrder = members.reduce((max, m) => (m.order ?? 0) > max ? (m.order ?? 0) : max, -1);
  members.push({ ...member, id, order: maxOrder + 1, joinedAt: new Date().toISOString() });
  return id;
}

export async function updateMember(_organizationId: string, id: string, data: Partial<Member>): Promise<void> {
  members = members.map((m) => (m.id === id ? { ...m, ...data } : m));
}

export async function deleteMember(_organizationId: string, id: string): Promise<void> {
  members = members.filter((m) => m.id !== id);
}

// ── Attendance ──────────────────────────────────────

export async function getAttendances(_organizationId: string): Promise<Attendance[]> {
  return [...attendances];
}

export async function setAttendance(_organizationId: string, attendance: Omit<Attendance, 'id'>): Promise<string> {
  const id = genId();
  attendances.push({ ...attendance, id, updatedAt: new Date().toISOString() });
  return id;
}

export async function updateAttendance(_organizationId: string, id: string, data: Partial<Attendance>): Promise<void> {
  attendances = attendances.map((a) =>
    a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
  );
}

// ── Doubles schedules ───────────────────────────────

function doublesKey(organizationId: string, eventId: string): string {
  return `${organizationId}/${eventId}`;
}

function notifyDoublesSchedule(organizationId: string, eventId: string): void {
  const key = doublesKey(organizationId, eventId);
  const schedule = doublesSchedules.get(key);
  doublesListeners.get(key)?.forEach((listener) => {
    listener(schedule ? structuredClone(schedule) : null);
  });
}

export function subscribeDoublesSchedule(
  organizationId: string,
  eventId: string,
  onData: (schedule: DoublesSchedule | null) => void,
  _onError: (error: Error) => void,
): () => void {
  const key = doublesKey(organizationId, eventId);
  const listeners = doublesListeners.get(key) ?? new Set();
  listeners.add(onData);
  doublesListeners.set(key, listeners);
  const schedule = doublesSchedules.get(key);
  onData(schedule ? structuredClone(schedule) : null);
  return () => {
    listeners.delete(onData);
    if (listeners.size === 0) doublesListeners.delete(key);
  };
}

export async function createDoublesSchedule(
  organizationId: string,
  eventId: string,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> {
  const key = doublesKey(organizationId, eventId);
  if (doublesSchedules.has(key)) return false;
  const now = new Date().toISOString();
  doublesSchedules.set(key, {
    eventId,
    generationId: createGenerationId(),
    revision: 0,
    matches: structuredClone(matches),
    participantCount,
    createdAt: now,
    updatedAt: now,
  });
  notifyDoublesSchedule(organizationId, eventId);
  return true;
}

export async function replaceDoublesSchedule(
  organizationId: string,
  eventId: string,
  expectedGenerationId: string,
  expectedRevision: number,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> {
  const key = doublesKey(organizationId, eventId);
  const current = doublesSchedules.get(key);
  if (
    !current
    || current.generationId !== expectedGenerationId
    || current.revision !== expectedRevision
  ) return false;
  const now = new Date().toISOString();
  doublesSchedules.set(key, {
    eventId,
    generationId: createGenerationId(),
    revision: 0,
    matches: structuredClone(matches),
    participantCount,
    createdAt: now,
    updatedAt: now,
  });
  notifyDoublesSchedule(organizationId, eventId);
  return true;
}

export async function setDoublesMatchCompleted(
  organizationId: string,
  eventId: string,
  expectedGenerationId: string,
  matchNumber: number,
  completed: boolean,
): Promise<boolean> {
  const schedule = doublesSchedules.get(doublesKey(organizationId, eventId));
  if (!schedule || schedule.generationId !== expectedGenerationId) return false;
  if (!schedule.matches.some((match) => match.number === matchNumber)) {
    throw new Error('対象の試合が見つかりません。');
  }
  schedule.matches = schedule.matches.map((match) => (
    match.number === matchNumber ? { ...match, completed } : match
  ));
  schedule.revision += 1;
  schedule.updatedAt = new Date().toISOString();
  notifyDoublesSchedule(organizationId, eventId);
  return true;
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
  const schedule = doublesSchedules.get(doublesKey(organizationId, eventId));
  if (!schedule || schedule.generationId !== expectedGenerationId) return false;
  const target = schedule.matches.find((match) => match.number === matchNumber);
  if (!target || (target.scoreRevision ?? 0) !== expectedScoreRevision) return false;
  schedule.matches = schedule.matches.map((match) => (
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
  schedule.revision += 1;
  schedule.updatedAt = new Date().toISOString();
  notifyDoublesSchedule(organizationId, eventId);
  return true;
}

// ── Expenses ─────────────────────────────────────────

export async function getExpenses(_organizationId: string): Promise<Expense[]> {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
}

export async function addExpense(_organizationId: string, expense: Omit<Expense, 'id'>): Promise<string> {
  const id = genId();
  expenses.push({ ...expense, id, createdAt: new Date().toISOString() });
  return id;
}

export async function updateExpense(_organizationId: string, id: string, data: Partial<Expense>): Promise<void> {
  expenses = expenses.map((e) => (e.id === id ? { ...e, ...data } : e));
}

export async function deleteExpense(_organizationId: string, id: string): Promise<void> {
  expenses = expenses.filter((e) => e.id !== id);
}

// ── App Config ───────────────────────────────────────

export interface AppConfig {
  expensePassword: string;
  teamsWebhookUrl: string;
  lineToken: string;
  lineGroupId: string;
}

const configStorageKey = (organizationId: string) => `tennis_club_app_config_${organizationId}`;
const DEFAULT_CONFIG: AppConfig = {
  expensePassword: 'tennis123',
  teamsWebhookUrl: '',
  lineToken: '',
  lineGroupId: '',
};

export async function getAppConfig(organizationId: string): Promise<AppConfig> {
  try {
    const raw = localStorage.getItem(configStorageKey(organizationId));
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export async function saveAppConfig(organizationId: string, data: Partial<AppConfig>): Promise<void> {
  const current = await getAppConfig(organizationId);
  localStorage.setItem(configStorageKey(organizationId), JSON.stringify({ ...current, ...data }));
}

// ── Posts (掲示板) ──────────────────────────────────

let posts: Post[] = [];

export async function getPosts(_organizationId: string): Promise<Post[]> {
  return [...posts].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function addPost(_organizationId: string, post: Omit<Post, 'id'>): Promise<string> {
  const id = genId();
  posts.push({ ...post, id, createdAt: new Date().toISOString() });
  return id;
}

export async function deletePost(_organizationId: string, id: string): Promise<void> {
  posts = posts.filter((p) => p.id !== id);
}
