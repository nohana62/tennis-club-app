/**
 * データサービスのエントリーポイント
 * VITE_DEMO_MODE=true またはFirebase未設定 の場合はモックデータを使用
 */
import type { ClubEvent, Member, Attendance, Expense, Post, DoublesSchedule, StoredDoublesMatch, OrganizationId } from "../types";
import type { AppConfig } from "./firebase";

import * as mock from "./mockFirebase";
import * as fb from "./firebase";

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
const hasFirebaseConfig = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);
const svc = (isDemo || !hasFirebaseConfig) ? mock : fb;

export const getEvents   = (org: OrganizationId): Promise<ClubEvent[]>                          => svc.getEvents(org);
export const addEvent    = (org: OrganizationId, e: Omit<ClubEvent, "id">): Promise<string>       => svc.addEvent(org, e);
export const updateEvent = (org: OrganizationId, id: string, e: Partial<ClubEvent>): Promise<void>=> svc.updateEvent(org, id, e);
export const deleteEvent = (org: OrganizationId, id: string): Promise<void>                        => svc.deleteEvent(org, id);

export const getMembers   = (org: OrganizationId): Promise<Member[]>                            => svc.getMembers(org);
export const addMember    = (org: OrganizationId, m: Omit<Member, "id">): Promise<string>         => svc.addMember(org, m);
export const updateMember = (org: OrganizationId, id: string, m: Partial<Member>): Promise<void>  => svc.updateMember(org, id, m);
export const deleteMember = (org: OrganizationId, id: string): Promise<void>                       => svc.deleteMember(org, id);

export const getAttendances  = (org: OrganizationId): Promise<Attendance[]>                           => svc.getAttendances(org);
export const setAttendance   = (org: OrganizationId, a: Omit<Attendance, "id">): Promise<string>        => svc.setAttendance(org, a);
export const updateAttendance= (org: OrganizationId, id: string, a: Partial<Attendance>): Promise<void> => svc.updateAttendance(org, id, a);

export const subscribeDoublesSchedule = (
  org: OrganizationId,
  eventId: string,
  onData: (schedule: DoublesSchedule | null) => void,
  onError: (error: Error) => void,
): (() => void) => svc.subscribeDoublesSchedule(org, eventId, onData, onError);
export const createDoublesSchedule = (
  org: OrganizationId,
  eventId: string,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> => svc.createDoublesSchedule(org, eventId, matches, participantCount);
export const replaceDoublesSchedule = (
  org: OrganizationId,
  eventId: string,
  expectedGenerationId: string,
  expectedRevision: number,
  matches: StoredDoublesMatch[],
  participantCount: number,
): Promise<boolean> => svc.replaceDoublesSchedule(
  org,
  eventId,
  expectedGenerationId,
  expectedRevision,
  matches,
  participantCount,
);
export const setDoublesMatchCompleted = (
  org: OrganizationId,
  eventId: string,
  expectedGenerationId: string,
  matchNumber: number,
  completed: boolean,
): Promise<boolean> => svc.setDoublesMatchCompleted(org, eventId, expectedGenerationId, matchNumber, completed);
export const saveDoublesMatchScore = (
  org: OrganizationId,
  eventId: string,
  expectedGenerationId: string,
  matchNumber: number,
  expectedScoreRevision: number,
  teamAGames: number,
  teamBGames: number,
): Promise<boolean> => svc.saveDoublesMatchScore(
  org,
  eventId,
  expectedGenerationId,
  matchNumber,
  expectedScoreRevision,
  teamAGames,
  teamBGames,
);

export const getExpenses   = (org: OrganizationId): Promise<Expense[]>                          => svc.getExpenses(org);
export const addExpense    = (org: OrganizationId, e: Omit<Expense, "id">): Promise<string>       => svc.addExpense(org, e);
export const updateExpense = (org: OrganizationId, id: string, e: Partial<Expense>): Promise<void>=> svc.updateExpense(org, id, e);
export const deleteExpense = (org: OrganizationId, id: string): Promise<void>                      => svc.deleteExpense(org, id);

export type { AppConfig };
export const getAppConfig  = (org: OrganizationId): Promise<AppConfig>              => svc.getAppConfig(org);
export const saveAppConfig = (org: OrganizationId, d: Partial<AppConfig>): Promise<void> => svc.saveAppConfig(org, d);

export const getPosts    = (org: OrganizationId): Promise<Post[]>                    => svc.getPosts(org);
export const addPost     = (org: OrganizationId, p: Omit<Post, 'id'>): Promise<string> => svc.addPost(org, p);
export const deletePost  = (org: OrganizationId, id: string): Promise<void>            => svc.deletePost(org, id);
