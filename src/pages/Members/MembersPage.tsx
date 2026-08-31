import { useEffect, useRef, useState } from 'react';
import { Plus, X, Pencil, Trash2, UserCheck, UserX, Clock, GripVertical } from 'lucide-react';
import { getMembers, addMember, updateMember, deleteMember, getAttendances, setAttendance, updateAttendance, getEvents } from '../../services/index';
import type { Member, Attendance, AttendanceStatus, ClubEvent } from '../../types';

const EMPTY_MEMBER: Omit<Member, 'id'> = {
  name: '',
  department: '',
  email: '',
  phone: '',
  role: 'member',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: '参加',
  absent: '欠席',
  pending: '未回答',
};

const STATUS_ICON: Record<AttendanceStatus, React.ReactNode> = {
  attending: <UserCheck size={14} />,
  absent: <UserX size={14} />,
  pending: <Clock size={14} />,
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  attending: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  pending: 'bg-gray-100 text-gray-500',
};

async function saveOrder(ordered: Member[]) {
  await Promise.all(ordered.map((m, i) => {
    if (m.id && m.order !== i) return updateMember(m.id, { order: i });
  }));
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Omit<Member, 'id'>>(EMPTY_MEMBER);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [tab, setTab] = useState<'members' | 'attendance'>('members');

  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [m, e, a] = await Promise.all([getMembers(), getEvents(), getAttendances()]);
    setMembers(m);
    setEvents(e);
    setAttendances(a);
    if (e.length > 0 && !selectedEvent) setSelectedEvent(e[0].id ?? '');
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (editing?.id) {
      await updateMember(editing.id, form);
    } else {
      await addMember(form);
    }
    setShowForm(false);
    await load();
  }

  async function handleDelete(m: Member) {
    if (!m.id || !window.confirm(`「${m.name}」を削除しますか？`)) return;
    await deleteMember(m.id);
    await load();
  }

  async function handleAttendance(memberId: string, memberName: string, status: AttendanceStatus) {
    const existing = attendances.find(a => a.eventId === selectedEvent && a.memberId === memberId);
    if (existing?.id) {
      await updateAttendance(existing.id, { status });
    } else {
      await setAttendance({ eventId: selectedEvent, memberId, memberName, status });
    }
    const fresh = await getAttendances();
    setAttendances(fresh);
  }

  // ── ドラッグ並び替えハンドラ（PC） ──────────────────────────
  function onDragStart(index: number) {
    dragIndex.current = index;
  }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex.current = index;
  }
  async function onDrop() {
    if (dragIndex.current === null || dragOverIndex.current === null) return;
    if (dragIndex.current === dragOverIndex.current) return;
    const next = [...members];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(dragOverIndex.current, 0, moved);
    setMembers(next);
    await saveOrder(next);
    dragIndex.current = null;
    dragOverIndex.current = null;
  }

  // ── タッチ並び替えハンドラ（iPhone） ─────────────────────────
  const touchStartY = useRef<number>(0);
  const touchItemIndex = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent, index: number) {
    touchStartY.current = e.touches[0].clientY;
    touchItemIndex.current = index;
  }
  async function onTouchEnd(e: React.TouchEvent) {
    if (touchItemIndex.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const itemHeight = 72;
    const steps = Math.round(dy / itemHeight);
    if (steps === 0) { touchItemIndex.current = null; return; }
    const from = touchItemIndex.current;
    const to = Math.max(0, Math.min(members.length - 1, from + steps));
    if (from !== to) {
      const next = [...members];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setMembers(next);
      await saveOrder(next);
    }
    touchItemIndex.current = null;
  }

  const attendanceForEvent = attendances.filter(a => a.eventId === selectedEvent);
  const getStatus = (memberId: string): AttendanceStatus =>
    attendanceForEvent.find(a => a.memberId === memberId)?.status ?? 'pending';

  // 未回答 = 全部員数 - 参加数 - 欠席数（レコードなし部員も未回答扱い）
  const attendingCount = members.filter(m => getStatus(m.id!) === 'attending').length;
  const absentCount = members.filter(m => getStatus(m.id!) === 'absent').length;
  const pendingCount = members.length - attendingCount - absentCount;
  const attendRate = members.length ? Math.round((attendingCount / members.length) * 100) : 0;

  const statCounts: Record<AttendanceStatus, number> = {
    attending: attendingCount,
    absent: absentCount,
    pending: pendingCount,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">参加者管理</h1>
        {tab === 'members' && (
          <button
            onClick={() => { setEditing(null); setForm(EMPTY_MEMBER); setShowForm(true); }}
            className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
          >
            <Plus size={16} /> 部員追加
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['members', 'attendance'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'members' ? '部員一覧' : '参加登録'}
          </button>
        ))}
      </div>

      {tab === 'members' ? (
        <div className="space-y-2">
          {members.length === 0 && <p className="text-gray-400 text-sm">部員が登録されていません</p>}
          {members.length > 1 && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <GripVertical size={12} /> 左端のアイコンをドラッグして並び替えできます
            </p>
          )}
          {members.map((m, index) => (
            <div
              key={m.id}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={onDrop}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 transition-shadow"
            >
              <div
                draggable
                onDragStart={() => onDragStart(index)}
                onTouchStart={(e) => onTouchStart(e, index)}
                onTouchEnd={onTouchEnd}
                className="text-gray-300 shrink-0 touch-none select-none cursor-grab active:cursor-grabbing p-1"
              >
                <GripVertical size={18} />
              </div>
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">
                {m.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{m.name}</span>
                  {m.role === 'admin' && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">管理者</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{m.department}</p>
                {m.email && <p className="text-xs text-gray-400">{m.email}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(m); setForm({ name: m.name, department: m.department, email: m.email, phone: m.phone, role: m.role }); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(m)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm">イベントがありません</p>
          ) : (
            <>
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">イベント選択</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.date} {ev.title}</option>
                  ))}
                </select>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['attending', 'absent', 'pending'] as AttendanceStatus[]).map((s) => (
                  <div key={s} className={`rounded-xl p-3 text-center ${STATUS_COLOR[s]}`}>
                    <div className="text-xl font-bold">{statCounts[s]}</div>
                    <div className="text-xs">{STATUS_LABEL[s]}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mb-3">参加率: {attendRate}%</p>
              <div className="space-y-2">
                {members.map((m) => {
                  const status = getStatus(m.id!);
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {m.name.slice(0, 1)}
                      </div>
                      <div className="flex-1 text-sm font-medium text-gray-800">{m.name}</div>
                      <div className="flex gap-1">
                        {(['attending', 'absent', 'pending'] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleAttendance(m.id!, m.name, s)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${status === s ? STATUS_COLOR[s] + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          >
                            {STATUS_ICON[s]} {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Member Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{editing ? '部員編集' : '部員追加'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required type="text" placeholder="氏名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="text" placeholder="部署" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="email" placeholder="メールアドレス" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input type="tel" placeholder="電話番号" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Member['role'] })} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="member">一般部員</option>
                <option value="admin">管理者</option>
              </select>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">
                  {editing ? '更新' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
