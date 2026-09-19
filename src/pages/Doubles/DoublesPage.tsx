import { useEffect, useMemo, useState } from 'react';
import { Plus, Shuffle, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { getAttendances, getEvents, getMembers } from '../../services';
import type { Attendance, ClubEvent, Member } from '../../types';
import {
  generateDoublesMatches,
  type DoublesMatch,
  type DoublesParticipant,
} from '../../utils/doubles';
import { isEventCancelled } from '../../utils/events';

const DEFAULT_MATCH_COUNT = 20;
const MAX_MATCH_COUNT = 100;

function getEventParticipants(
  eventId: string,
  attendances: Attendance[],
  members: Member[],
): DoublesParticipant[] {
  const byId = new Map(members.filter((member) => member.id).map((member) => [member.id!, member]));
  const byName = new Map(members.map((member) => [member.name.trim(), member]));
  const result = new Map<string, DoublesParticipant>();

  attendances
    .filter((attendance) => attendance.eventId === eventId && attendance.status === 'attending')
    .forEach((attendance) => {
      const member = (attendance.memberId ? byId.get(attendance.memberId) : undefined)
        ?? byName.get(attendance.memberName.trim());
      const id = member?.id ?? `name:${attendance.memberName.trim()}`;
      result.set(id, { id, name: member?.name ?? attendance.memberName.trim() });
    });

  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export default function DoublesPage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [temporaryParticipants, setTemporaryParticipants] = useState<DoublesParticipant[]>([]);
  const [temporaryName, setTemporaryName] = useState('');
  const [matchCount, setMatchCount] = useState(String(DEFAULT_MATCH_COUNT));
  const [matches, setMatches] = useState<DoublesMatch[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [eventData, memberData, attendanceData] = await Promise.all([
          getEvents(),
          getMembers(),
          getAttendances(),
        ]);
        const sortedEvents = eventData
          .filter((event) => !isEventCancelled(event))
          .sort((a, b) => a.date.localeCompare(b.date));
        const today = format(new Date(), 'yyyy-MM-dd');
        const initialEvent = sortedEvents.find((event) => event.date >= today)
          ?? sortedEvents.at(-1);
        setEvents(sortedEvents);
        setMembers(memberData);
        setAttendances(attendanceData);
        setSelectedEventId(initialEvent?.id ?? '');
      } catch (loadError) {
        console.error('組み合わせ作成データの読み込みに失敗しました', loadError);
        setError('データを読み込めませんでした。通信状態を確認して再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const eventParticipants = useMemo(
    () => getEventParticipants(selectedEventId, attendances, members),
    [selectedEventId, attendances, members],
  );
  const selectedParticipants = useMemo(
    () => [
      ...eventParticipants.filter((participant) => !excludedIds.has(participant.id)),
      ...temporaryParticipants,
    ],
    [eventParticipants, excludedIds, temporaryParticipants],
  );

  function changeEvent(eventId: string) {
    setSelectedEventId(eventId);
    setExcludedIds(new Set());
    setTemporaryParticipants([]);
    setTemporaryName('');
    setMatches([]);
    setError('');
  }

  function toggleParticipant(id: string) {
    setExcludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMatches([]);
  }

  function selectAllParticipants() {
    setExcludedIds(new Set());
    setMatches([]);
  }

  function addTemporaryParticipant() {
    const name = temporaryName.trim();
    if (!name) {
      setError('追加する人の名前を入力してください。');
      return;
    }
    const duplicate = [...eventParticipants, ...temporaryParticipants]
      .some((participant) => participant.name.trim() === name);
    if (duplicate) {
      setError('同じ名前の参加者がすでに登録されています。');
      return;
    }

    setTemporaryParticipants((current) => [
      ...current,
      { id: `temporary:${Date.now()}:${current.length}`, name },
    ]);
    setTemporaryName('');
    setMatches([]);
    setError('');
  }

  function removeTemporaryParticipant(id: string) {
    setTemporaryParticipants((current) => current.filter((participant) => participant.id !== id));
    setMatches([]);
  }

  function createMatches() {
    const count = Number(matchCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_MATCH_COUNT) {
      setError(`試合数は1〜${MAX_MATCH_COUNT}の整数で入力してください。`);
      return;
    }
    if (selectedParticipants.length < 4) {
      setError('組み合わせ作成には、選択中の参加者が4人以上必要です。');
      return;
    }
    setMatches(generateDoublesMatches(selectedParticipants, count));
    setError('');
  }

  if (loading) return <div className="text-gray-400 text-sm p-4">読み込み中...</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Shuffle size={22} className="text-green-700" /> ダブルス組み合わせ
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          出場回数を均等にしながら、同じペア・対戦相手の重複が少ない組み合わせを作成します。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 md:p-5 space-y-5 mb-5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">対象の予定</label>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">組み合わせを作成できる実施予定がありません。</p>
          ) : (
            <select
              value={selectedEventId}
              onChange={(event) => changeEvent(event.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.date}　{event.title}{event.location ? `（${event.location}）` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm">参加回答者</h2>
              <p className="text-xs text-gray-400">チェックを外すと今回の組み合わせから除外します。</p>
            </div>
            {excludedIds.size > 0 && (
              <button
                type="button"
                onClick={selectAllParticipants}
                className="text-xs text-green-700 hover:bg-green-50 rounded-lg px-2 py-1 shrink-0"
              >
                全員選択
              </button>
            )}
          </div>
          {eventParticipants.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">「参加」の回答者がいません。</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {eventParticipants.map((participant) => (
                <label
                  key={participant.id}
                  className={`flex items-center gap-2 border rounded-lg p-2.5 text-sm cursor-pointer transition ${
                    excludedIds.has(participant.id)
                      ? 'border-gray-100 bg-gray-50 text-gray-400'
                      : 'border-green-200 bg-green-50 text-green-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!excludedIds.has(participant.id)}
                    onChange={() => toggleParticipant(participant.id)}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="truncate">{participant.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-gray-700 text-sm mb-1">一時参加者を追加</h2>
          <p className="text-xs text-gray-400 mb-2">ここで追加した人は部員一覧には保存されません。</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={temporaryName}
              onChange={(event) => { setTemporaryName(event.target.value); setError(''); }}
              onKeyDown={(event) => { if (event.key === 'Enter') addTemporaryParticipant(); }}
              placeholder="参加者名"
              className="min-w-0 flex-1 border rounded-lg px-3 py-2 text-sm"
              maxLength={50}
            />
            <button
              type="button"
              onClick={addTemporaryParticipant}
              className="flex items-center gap-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm hover:bg-gray-800 shrink-0"
            >
              <Plus size={16} /> 追加
            </button>
          </div>
          {temporaryParticipants.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {temporaryParticipants.map((participant) => (
                <span
                  key={participant.id}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs"
                >
                  {participant.name}
                  <button
                    type="button"
                    onClick={() => removeTemporaryParticipant(participant.id)}
                    className="p-0.5 hover:text-red-600"
                    aria-label={`${participant.name}を削除`}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
          <div className="sm:w-36">
            <label className="text-xs text-gray-500 mb-1 block">試合数</label>
            <input
              type="number"
              min="1"
              max={MAX_MATCH_COUNT}
              value={matchCount}
              onChange={(event) => { setMatchCount(event.target.value); setMatches([]); setError(''); }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={createMatches}
            disabled={!selectedEventId}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
          >
            <Shuffle size={18} /> 組み合わせ作成
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <UserCheck size={17} className="text-green-600" />
          <span className="text-gray-600">組み合わせ対象:</span>
          <strong className={selectedParticipants.length >= 4 ? 'text-green-700' : 'text-amber-600'}>
            {selectedParticipants.length}人
          </strong>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3" role="alert">{error}</p>}
      </div>

      {matches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-green-700 text-white flex items-center justify-between">
            <h2 className="font-semibold">組み合わせ表</h2>
            <span className="text-xs text-green-100">{matches.length}試合</span>
          </div>

          {/* スマホ: 2つのペアを上下に分けて名前を読みやすく表示 */}
          <div className="md:hidden divide-y divide-gray-100">
            {matches.map((match) => (
              <div key={match.number} className="p-3 even:bg-gray-50/60">
                <div className="text-xs font-bold text-gray-500 mb-2">第{match.number}試合</div>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-blue-500 mb-1">ペアA</div>
                  <div className="grid grid-cols-2 divide-x divide-blue-200">
                    <span className="px-1 text-center text-sm font-semibold text-blue-800 break-words">
                      {match.teamA[0].name}
                    </span>
                    <span className="px-1 text-center text-sm font-semibold text-blue-800 break-words">
                      {match.teamA[1].name}
                    </span>
                  </div>
                </div>
                <div className="text-center text-xs font-bold text-gray-400 leading-6">vs</div>
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <div className="text-[10px] font-semibold text-red-500 mb-1">ペアB</div>
                  <div className="grid grid-cols-2 divide-x divide-red-200">
                    <span className="px-1 text-center text-sm font-semibold text-red-800 break-words">
                      {match.teamB[0].name}
                    </span>
                    <span className="px-1 text-center text-sm font-semibold text-red-800 break-words">
                      {match.teamB[1].name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* PC: 従来どおり横一列の表 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse">
              <thead>
                <tr className="bg-green-50 text-xs text-gray-600">
                  <th className="p-2.5 text-center w-16">試合</th>
                  <th className="p-2.5 text-center">ペアA</th>
                  <th className="p-2.5 text-center w-10">対戦</th>
                  <th className="p-2.5 text-center">ペアB</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.number} className="border-t border-gray-100 even:bg-gray-50/60">
                    <td className="p-2.5 text-center text-xs font-semibold text-gray-500">
                      第{match.number}試合
                    </td>
                    <td className="p-2.5 text-center text-sm font-medium text-blue-700">
                      {match.teamA[0].name}<span className="text-gray-400 mx-1">・</span>{match.teamA[1].name}
                    </td>
                    <td className="p-2.5 text-center text-xs font-bold text-gray-400">vs</td>
                    <td className="p-2.5 text-center text-sm font-medium text-red-700">
                      {match.teamB[0].name}<span className="text-gray-400 mx-1">・</span>{match.teamB[1].name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
