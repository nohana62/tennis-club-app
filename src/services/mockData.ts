import { format, addDays, subDays } from 'date-fns';
import type { ClubEvent, Member, Attendance, Expense } from '../types';

const today = format(new Date(), 'yyyy-MM-dd');
const thisMonth = format(new Date(), 'yyyy-MM');

export const MOCK_MEMBERS: Member[] = [
  { id: 'm1', name: '田中 一郎', department: '営業部', email: 'tanaka@example.com', phone: '090-1111-1111', role: 'admin', joinedAt: '2025-04-01' },
  { id: 'm2', name: '鈴木 花子', department: '開発部', email: 'suzuki@example.com', phone: '090-2222-2222', role: 'member', joinedAt: '2025-04-01' },
  { id: 'm3', name: '佐藤 次郎', department: '総務部', email: 'sato@example.com', phone: '090-3333-3333', role: 'member', joinedAt: '2025-05-01' },
  { id: 'm4', name: '山田 三郎', department: '人事部', email: 'yamada@example.com', phone: '090-4444-4444', role: 'member', joinedAt: '2025-06-01' },
];

export const MOCK_EVENTS: ClubEvent[] = [
  {
    id: 'e1',
    title: '定期練習',
    date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    startTime: '18:00',
    endTime: '20:00',
    location: '市民テニスコート A面',
    description: '基礎練習・ラリー',
    type: 'practice',
    fee: 3200,
    feeCategory: 'court',
    feeDescription: '市民テニスコート使用料（A面 2時間）',
    createdAt: `${thisMonth}-01`,
  },
  {
    id: 'e2',
    title: '定期練習',
    date: today,
    startTime: '18:00',
    endTime: '20:00',
    location: '市民テニスコート B面',
    description: 'ダブルス練習',
    type: 'practice',
    fee: 3200,
    feeCategory: 'court',
    feeDescription: '市民テニスコート使用料（B面 2時間）',
    createdAt: `${thisMonth}-01`,
  },
  {
    id: 'e3',
    title: '他社交流戦',
    date: format(addDays(new Date(), 5), 'yyyy-MM-dd'),
    startTime: '13:00',
    endTime: '17:00',
    location: '〇〇テニスクラブ',
    description: 'ABC株式会社との親善試合。ダブルス3ペア出場予定。',
    type: 'match',
    fee: 5000,
    feeCategory: 'court',
    feeDescription: '〇〇テニスクラブ施設使用料',
    createdAt: `${thisMonth}-01`,
  },
  {
    id: 'e4',
    title: '定期練習',
    date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    startTime: '18:00',
    endTime: '20:00',
    location: '市民テニスコート A面',
    description: '試合に向けた強化練習',
    type: 'practice',
    fee: 3200,
    feeCategory: 'court',
    feeDescription: '市民テニスコート使用料（A面 2時間）',
    createdAt: `${thisMonth}-01`,
  },
];

export const MOCK_ATTENDANCES: Attendance[] = [
  { id: 'a1', eventId: 'e1', memberId: 'm1', memberName: '田中 一郎', status: 'attending' },
  { id: 'a2', eventId: 'e1', memberId: 'm2', memberName: '鈴木 花子', status: 'attending' },
  { id: 'a3', eventId: 'e1', memberId: 'm3', memberName: '佐藤 次郎', status: 'absent' },
  { id: 'a4', eventId: 'e1', memberId: 'm4', memberName: '山田 三郎', status: 'attending' },
  { id: 'a5', eventId: 'e2', memberId: 'm1', memberName: '田中 一郎', status: 'attending' },
  { id: 'a6', eventId: 'e2', memberId: 'm2', memberName: '鈴木 花子', status: 'pending' },
  { id: 'a7', eventId: 'e3', memberId: 'm1', memberName: '田中 一郎', status: 'attending' },
  { id: 'a8', eventId: 'e3', memberId: 'm3', memberName: '佐藤 次郎', status: 'attending' },
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'x1',
    date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    category: 'court',
    description: '市民テニスコート使用料（A面 2時間）',
    amount: 3200,
    paidBy: '田中 一郎',
    eventId: 'e1',
    createdAt: `${thisMonth}-01`,
  },
  {
    id: 'x2',
    date: today,
    category: 'court',
    description: '市民テニスコート使用料（B面 2時間）',
    amount: 3200,
    paidBy: '',
    eventId: 'e2',
    createdAt: today,
  },
  {
    id: 'x3',
    date: today,
    category: 'ball',
    description: 'テニスボール購入（1缶）',
    amount: 800,
    paidBy: '鈴木 花子',
    createdAt: today,
  },
  {
    id: 'x4',
    date: today,
    category: 'food',
    description: '練習後の飲み物代',
    amount: 1600,
    paidBy: '佐藤 次郎',
    createdAt: today,
  },
];
