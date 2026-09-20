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
  /** 未設定の既存データは scheduled（実施）として扱う */
  status?: 'scheduled' | 'cancelled';
  /** 中止時に通常料金の代わりに経費連携する金額 */
  cancellationFee?: number;
  createdAt?: string;
}

export interface Member {
  id?: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  role: 'admin' | 'member';
  order?: number;
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

export interface StoredDoublesParticipant {
  id: string;
  name: string;
}

export interface StoredDoublesMatch {
  number: number;
  teamA: [StoredDoublesParticipant, StoredDoublesParticipant];
  teamB: [StoredDoublesParticipant, StoredDoublesParticipant];
  completed: boolean;
  teamAGames?: number;
  teamBGames?: number;
  scoreRevision?: number;
}

export interface DoublesSchedule {
  eventId: string;
  generationId: string;
  revision: number;
  matches: StoredDoublesMatch[];
  participantCount: number;
  createdAt: string;
  updatedAt: string;
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

export interface Post {
  id?: string;
  authorName: string;
  content: string;
  important: boolean;
  createdAt?: string;
}
