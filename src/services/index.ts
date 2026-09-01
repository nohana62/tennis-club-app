/**
 * データサービスのエントリーポイント
 * VITE_DEMO_MODE=true またはFirebase未設定 の場合はモックデータを使用
 */
import type { ClubEvent, Member, Attendance, Expense } from "../types";
import type { AppConfig } from "./firebase";

import * as mock from "./mockFirebase";
import * as fb from "./firebase";

const isDemo = import.meta.env.VITE_DEMO_MODE === "true";
const hasFirebaseConfig = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
);
const svc = (isDemo || !hasFirebaseConfig) ? mock : fb;

export const getEvents   = (): Promise<ClubEvent[]>                          => svc.getEvents();
export const addEvent    = (e: Omit<ClubEvent, "id">): Promise<string>       => svc.addEvent(e);
export const updateEvent = (id: string, e: Partial<ClubEvent>): Promise<void>=> svc.updateEvent(id, e);
export const deleteEvent = (id: string): Promise<void>                        => svc.deleteEvent(id);

export const getMembers   = (): Promise<Member[]>                            => svc.getMembers();
export const addMember    = (m: Omit<Member, "id">): Promise<string>         => svc.addMember(m);
export const updateMember = (id: string, m: Partial<Member>): Promise<void>  => svc.updateMember(id, m);
export const deleteMember = (id: string): Promise<void>                       => svc.deleteMember(id);

export const getAttendances  = (): Promise<Attendance[]>                           => svc.getAttendances();
export const setAttendance   = (a: Omit<Attendance, "id">): Promise<string>        => svc.setAttendance(a);
export const updateAttendance= (id: string, a: Partial<Attendance>): Promise<void> => svc.updateAttendance(id, a);

export const getExpenses   = (): Promise<Expense[]>                          => svc.getExpenses();
export const addExpense    = (e: Omit<Expense, "id">): Promise<string>       => svc.addExpense(e);
export const updateExpense = (id: string, e: Partial<Expense>): Promise<void>=> svc.updateExpense(id, e);
export const deleteExpense = (id: string): Promise<void>                      => svc.deleteExpense(id);

export type { AppConfig };
export const getAppConfig  = (): Promise<AppConfig>              => svc.getAppConfig();
export const saveAppConfig = (d: Partial<AppConfig>): Promise<void> => svc.saveAppConfig(d);
