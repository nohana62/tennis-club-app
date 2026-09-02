import { useEffect, useState } from 'react';
import { UserCheck, UserX, Clock } from 'lucide-react';
import { getMembers, getAttendances, setAttendance, updateAttendance, getEvents } from '../../services/index';
import type { Member, Attendance, AttendanceStatus, ClubEvent } from '../../types';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attending: '参加',
  absent: '欠席',
  hold: '保留',
  pending: '未回答',
};

const STATUS_ICON: Record<AttendanceStatus, React.ReactNode> = {
  attending: <UserCheck size={14} />,
  absent: <UserX size={14} />,
  hold: <Clock size={12} />,
  pending: <Clock size={14} />,
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  attending: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  hold: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-gray-100 text-gray-500',
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [attendanceView, setAttendanceView] = useState<'byMember' | 'byDate'>('byMember');

  useEffect(() => { load(); }, []);

  async function load() {
    const [m, e, a] = await Promise.all([getMembers(), getEvents(), getAttendances()]);
    setMembers(m);
    setEvents(e);
    setAttendances(a);
    if (e.length > 0 && !selectedEvent) setSelectedEvent(e[0].id ?? '');
    if (m.length > 0 && !selectedMember) setSelectedMember(m[0].id ?? '');
  }

  async function handleAttendance(eventId: string, memberId: string, memberName: string, status: AttendanceStatus) {
    const existing = attendances.find(a => a.eventId === eventId && a.memberId === memberId);
    if (existing?.id) {
      await updateAttendance(existing.id, { status });
    } else {
      await setAttendance({ eventId, memberId, memberName, status });
    }
    const fresh = await getAttendances();
    setAttendances(fresh);
  }

  const getStatus = (memberId: string, eventId: string = selectedEvent): AttendanceStatus =>
    attendances.find(a => a.eventId === eventId && a.memberId === memberId)?.status ?? 'pending';

  // 未回答 = 全部員数 - 参加数 - 欠席数 - 保留数（レコードなし部員も未回答扱い）
  const attendingCount = members.filter(m => getStatus(m.id!) === 'attending').length;
  const absentCount = members.filter(m => getStatus(m.id!) === 'absent').length;
  const holdCount = members.filter(m => getStatus(m.id!) === 'hold').length;
  const pendingCount = members.length - attendingCount - absentCount - holdCount;
  const attendRate = members.length ? Math.round((attendingCount / members.length) * 100) : 0;

  const statCounts: Record<AttendanceStatus, number> = {
    attending: attendingCount,
    absent: absentCount,
    hold: holdCount,
    pending: pendingCount,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">参加者管理</h1>
      </div>

      {events.length === 0 ? (
        <p className="text-gray-400 text-sm">イベントがありません</p>
      ) : (
        <>
          {/* 表示モード切り替え */}
          <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg w-fit">
            {(['byMember', 'byDate'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setAttendanceView(v)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${attendanceView === v ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v === 'byDate' ? '日ごと' : '名前ごと'}
              </button>
            ))}
          </div>

          {attendanceView === 'byDate' ? (
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
              <div className="grid grid-cols-4 gap-2 mb-4">
                {(['attending', 'absent', 'hold', 'pending'] as AttendanceStatus[]).map((s) => (
                  <div key={s} className={`rounded-xl p-2 text-center ${STATUS_COLOR[s]}`}>
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
                      <div className="flex gap-1 flex-wrap justify-end">
                        {(['attending', 'absent'] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleAttendance(selectedEvent, m.id!, m.name, s)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${status === s ? STATUS_COLOR[s] + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          >
                            {STATUS_ICON[s]} {STATUS_LABEL[s]}
                          </button>
                        ))}
                        {/* 保留：小さめ */}
                        <button
                          onClick={() => handleAttendance(selectedEvent, m.id!, m.name, 'hold')}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] transition ${status === 'hold' ? STATUS_COLOR['hold'] + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                          {STATUS_ICON['hold']} {STATUS_LABEL['hold']}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* 名前ごと：1人分をまとめて全日程分登録 */}
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">部員選択</label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {[...events].sort((a, b) => a.date.localeCompare(b.date)).map((ev) => {
                  const status = getStatus(selectedMember, ev.id!);
                  return (
                    <div key={ev.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <p className="text-sm font-medium text-gray-800">{ev.title}</p>
                        <p className="text-xs text-gray-400">
                          {ev.date}{ev.location ? ` ｜ ${ev.location}` : ''}
                          {ev.startTime ? ` ｜ ${ev.startTime}${ev.endTime ? `〜${ev.endTime}` : ''}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {(['attending', 'absent'] as AttendanceStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleAttendance(ev.id!, selectedMember, members.find(m => m.id === selectedMember)?.name ?? '', s)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${status === s ? STATUS_COLOR[s] + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                          >
                            {STATUS_ICON[s]} {STATUS_LABEL[s]}
                          </button>
                        ))}
                        <button
                          onClick={() => handleAttendance(ev.id!, selectedMember, members.find(m => m.id === selectedMember)?.name ?? '', 'hold')}
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] transition ${status === 'hold' ? STATUS_COLOR['hold'] + ' font-semibold' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                          {STATUS_ICON['hold']} {STATUS_LABEL['hold']}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
