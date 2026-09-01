/**
 * デモモード用モックサービス
 * Firebase の代わりにメモリ内データを使用します。
 * データはページリロードでリセットされます。
 */
import { MOCK_MEMBERS, MOCK_EVENTS, MOCK_ATTENDANCES, MOCK_EXPENSES } from './mockData';
import type { ClubEvent, Member, Attendance, Expense, Post } from '../types';

// メモリ内ストア（コピーして書き込み可能にする）
let events: ClubEvent[] = structuredClone(MOCK_EVENTS);
let members: Member[] = structuredClone(MOCK_MEMBERS);
let attendances: Attendance[] = structuredClone(MOCK_ATTENDANCES);
let expenses: Expense[] = structuredClone(MOCK_EXPENSES);

let nextId = 100;
const genId = () => `mock-${nextId++}`;

// ── Events ──────────────────────────────────────────

export async function getEvents(): Promise<ClubEvent[]> {
  return [...events].sort((a, b) => a.date.localeCompare(b.date));
}

export async function addEvent(event: Omit<ClubEvent, 'id'>): Promise<string> {
  const id = genId();
  events.push({ ...event, id, createdAt: new Date().toISOString() });
  return id;
}

export async function updateEvent(id: string, data: Partial<ClubEvent>): Promise<void> {
  events = events.map((e) => (e.id === id ? { ...e, ...data } : e));
}

export async function deleteEvent(id: string): Promise<void> {
  events = events.filter((e) => e.id !== id);
}

// ── Members ─────────────────────────────────────────

export async function getMembers(): Promise<Member[]> {
  return [...members].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function addMember(member: Omit<Member, 'id'>): Promise<string> {
  const id = genId();
  const maxOrder = members.reduce((max, m) => (m.order ?? 0) > max ? (m.order ?? 0) : max, -1);
  members.push({ ...member, id, order: maxOrder + 1, joinedAt: new Date().toISOString() });
  return id;
}

export async function updateMember(id: string, data: Partial<Member>): Promise<void> {
  members = members.map((m) => (m.id === id ? { ...m, ...data } : m));
}

export async function deleteMember(id: string): Promise<void> {
  members = members.filter((m) => m.id !== id);
}

// ── Attendance ──────────────────────────────────────

export async function getAttendances(): Promise<Attendance[]> {
  return [...attendances];
}

export async function setAttendance(attendance: Omit<Attendance, 'id'>): Promise<string> {
  const id = genId();
  attendances.push({ ...attendance, id, updatedAt: new Date().toISOString() });
  return id;
}

export async function updateAttendance(id: string, data: Partial<Attendance>): Promise<void> {
  attendances = attendances.map((a) =>
    a.id === id ? { ...a, ...data, updatedAt: new Date().toISOString() } : a
  );
}

// ── Expenses ─────────────────────────────────────────

export async function getExpenses(): Promise<Expense[]> {
  return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
}

export async function addExpense(expense: Omit<Expense, 'id'>): Promise<string> {
  const id = genId();
  expenses.push({ ...expense, id, createdAt: new Date().toISOString() });
  return id;
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<void> {
  expenses = expenses.map((e) => (e.id === id ? { ...e, ...data } : e));
}

export async function deleteExpense(id: string): Promise<void> {
  expenses = expenses.filter((e) => e.id !== id);
}

// ── App Config ───────────────────────────────────────

export interface AppConfig {
  expensePassword: string;
  teamsWebhookUrl: string;
  lineToken: string;
  lineGroupId: string;
}

const LS_CONFIG_KEY = 'tennis_club_app_config';
const DEFAULT_CONFIG: AppConfig = {
  expensePassword: 'tennis123',
  teamsWebhookUrl: '',
  lineToken: '',
  lineGroupId: '',
};

export async function getAppConfig(): Promise<AppConfig> {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export async function saveAppConfig(data: Partial<AppConfig>): Promise<void> {
  const current = await getAppConfig();
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify({ ...current, ...data }));
}

// ── Posts (掲示板) ──────────────────────────────────

let posts: Post[] = [];

export async function getPosts(): Promise<Post[]> {
  return [...posts].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function addPost(post: Omit<Post, 'id'>): Promise<string> {
  const id = genId();
  posts.push({ ...post, id, createdAt: new Date().toISOString() });
  return id;
}

export async function deletePost(id: string): Promise<void> {
  posts = posts.filter((p) => p.id !== id);
}
