export interface ClubEvent {
  id?: string;
  title: string;
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  location: string;
  description: string;
  type: 'practice' | 'match' | 'other';
  /** 使用料金（0 = なし） */
  fee?: number;
  /** 経費カテゴリ（fee > 0 の時に使用） */
  feeCategory?: ExpenseCategory;
  /** 経費の説明（省略時はタイトル+場所から自動生成） */
  feeDescription?: string;
  createdAt?: string;
}

export interface Member {
  id?: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  role: 'admin' | 'member';
  joinedAt?: string;
}

export type AttendanceStatus = 'attending' | 'absent' | 'pending';

export interface Attendance {
  id?: string;
  eventId: string;
  memberId: string;
  memberName: string;
  status: AttendanceStatus;
  comment?: string;
  updatedAt?: string;
}

export type ExpenseCategory = 'court' | 'ball' | 'equipment' | 'travel' | 'food' | 'other';

export interface Expense {
  id?: string;
  eventId?: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidBy: string;
  createdAt?: string;
}
