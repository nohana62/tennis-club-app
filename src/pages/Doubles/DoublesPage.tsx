import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Plus, RotateCcw, Shuffle, Trash2, UserCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import {
  createDoublesSchedule,
  getAttendances,
  getEvents,
  getMembers,
  replaceDoublesSchedule,
  setDoublesMatchCompleted,
  subscribeDoublesSchedule,
} from '../../services';
import type { Attendance, ClubEvent, DoublesSchedule, Member, StoredDoublesMatch } from '../../types';
import {
  generateDoublesMatches,
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
  const [savedSchedule, setSavedSchedule] = useState<DoublesSchedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [isRecreating, setIsRecreating] = useState(false);
  const [recreatingGenerationId, setRecreatingGenerationId] = useState<string | null>(null);
  const [recreatingRevision, setRecreatingRevision] = useState<number | null>(null);
  const [showRecreateConfirm, setShowRecreateConfirm] = useState(false);
  const [confirmingGenerationId, setConfirmingGenerationId] = useState<string | null>(null);
  const [confirmingRevision, setConfirmingRevision] = useState<number | null>(null);
  const [recreateConfirmation, setRecreateConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingMatchNumber, setUpdatingMatchNumber] = useState<number | null>(null);
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
        setScheduleLoading(Boolean(initialEvent?.id));
        setSelectedEventId(initialEvent?.id ?? '');
      } catch (loadError) {
        console.error('組み合わせ作成データの読み込みに失敗しました', loadError);
        setError('データを読み込めませんでした。通信状態を確認して再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    return subscribeDoublesSchedule(
      selectedEventId,
      (schedule) => {
        setSavedSchedule(schedule);
        setScheduleLoading(false);
      },
      (subscribeError) => {
        console.error('組み合わせ表の同期に失敗しました', subscribeError);
        setError('共有された組み合わせ表を読み込めませんでした。通信状態を確認してください。');
        setScheduleLoading(false);
      },
    );
  }, [selectedEventId]);

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
    setSavedSchedule(null);
    setScheduleLoading(Boolean(eventId));
    setIsRecreating(false);
    setRecreatingGenerationId(null);
    setRecreatingRevision(null);
    setShowRecreateConfirm(false);
    setConfirmingGenerationId(null);
    setConfirmingRevision(null);
    setRecreateConfirmation('');
    setSelectedEventId(eventId);
    setExcludedIds(new Set());
    setTemporaryParticipants([]);
    setTemporaryName('');
    setError('');
  }

  function toggleParticipant(id: string) {
    setExcludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllParticipants() {
    setExcludedIds(new Set());
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
    setError('');
  }

  function removeTemporaryParticipant(id: string) {
    setTemporaryParticipants((current) => current.filter((participant) => participant.id !== id));
  }

  async function createMatches() {
    const count = Number(matchCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_MATCH_COUNT) {
      setError(`試合数は1〜${MAX_MATCH_COUNT}の整数で入力してください。`);
      return;
    }
    if (selectedParticipants.length < 4) {
      setError('組み合わせ作成には、選択中の参加者が4人以上必要です。');
      return;
    }
    const generatedMatches: StoredDoublesMatch[] = generateDoublesMatches(selectedParticipants, count)
      .map((match) => ({ ...match, completed: false }));
    setSaving(true);
    setError('');
    try {
      if (savedSchedule && isRecreating) {
        if (!recreatingGenerationId || recreatingRevision === null) {
          setError('作り直しの確認情報がありません。もう一度ロックを解除してください。');
          return;
        }
        const replaced = await replaceDoublesSchedule(
          selectedEventId,
          recreatingGenerationId,
          recreatingRevision,
          generatedMatches,
          selectedParticipants.length,
        );
        if (!replaced) {
          setIsRecreating(false);
          setRecreatingGenerationId(null);
          setRecreatingRevision(null);
          setError('別の端末で組み合わせが作り直されました。最新の表を確認して、必要な場合はもう一度解除してください。');
          return;
        }
        setIsRecreating(false);
        setRecreatingGenerationId(null);
        setRecreatingRevision(null);
      } else {
        const created = await createDoublesSchedule(
          selectedEventId,
          generatedMatches,
          selectedParticipants.length,
        );
        if (!created) {
          setError('別の端末で先に組み合わせが作成されました。共有された表を表示します。');
        }
      }
    } catch (saveError) {
      console.error('組み合わせ表の保存に失敗しました', saveError);
      setError('組み合わせ表を保存できませんでした。通信状態を確認して、もう一度お試しください。');
    } finally {
      setSaving(false);
    }
  }

  function beginRecreation() {
    if (recreateConfirmation !== '作り直す') return;
    if (
      !confirmingGenerationId
      || confirmingRevision === null
      || confirmingGenerationId !== savedSchedule?.generationId
      || confirmingRevision !== savedSchedule.revision
    ) {
      setShowRecreateConfirm(false);
      setConfirmingGenerationId(null);
      setConfirmingRevision(null);
      setRecreateConfirmation('');
      setError('確認中に別の端末で進行状況または組み合わせが更新されました。最新の表を確認して、もう一度「作り直す」を押してください。');
      return;
    }
    setShowRecreateConfirm(false);
    setRecreateConfirmation('');
    setIsRecreating(true);
    setRecreatingGenerationId(confirmingGenerationId);
    setRecreatingRevision(confirmingRevision);
    setConfirmingGenerationId(null);
    setConfirmingRevision(null);
    setExcludedIds(new Set());
    setTemporaryParticipants([]);
    setTemporaryName('');
    setMatchCount(String(savedSchedule?.matches.length ?? DEFAULT_MATCH_COUNT));
    setError('');
  }

  function cancelRecreation() {
    setIsRecreating(false);
    setRecreatingGenerationId(null);
    setRecreatingRevision(null);
    setExcludedIds(new Set());
    setTemporaryParticipants([]);
    setTemporaryName('');
    setError('');
  }

  async function toggleMatchCompleted(match: StoredDoublesMatch) {
    if (!selectedEventId || updatingMatchNumber !== null) return;
    setUpdatingMatchNumber(match.number);
    setError('');
    try {
      if (!savedSchedule) return;
      const updated = await setDoublesMatchCompleted(
        selectedEventId,
        savedSchedule.generationId,
        match.number,
        !match.completed,
      );
      if (!updated) {
        setError('別の端末で組み合わせが更新されました。最新の表を確認して、もう一度操作してください。');
      }
    } catch (updateError) {
      console.error('試合の完了状態を更新できませんでした', updateError);
      setError('試合の完了状態を更新できませんでした。通信状態を確認して、もう一度お試しください。');
    } finally {
      setUpdatingMatchNumber(null);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm p-4">読み込み中...</div>;

  const matches = savedSchedule?.matches ?? [];
  const completedCount = matches.filter((match) => match.completed).length;

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

        {scheduleLoading ? (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">共有された組み合わせ表を確認中...</p>
        ) : (
          <>
            {savedSchedule && (
              <div className={`rounded-xl border p-4 ${
                isRecreating ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold flex items-center gap-2 ${
                      isRecreating ? 'text-amber-800' : 'text-green-800'
                    }`}>
                      {isRecreating ? <RotateCcw size={18} /> : <Lock size={18} />}
                      {isRecreating ? '新しい組み合わせを準備中' : '共有中・変更ロック済み'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      作成: {format(new Date(savedSchedule.createdAt), 'yyyy/MM/dd HH:mm')}
                      {' ｜ '}{savedSchedule.participantCount}人
                    </p>
                    {isRecreating && (
                      <p className="text-xs text-amber-700 mt-1">
                        新しい表を保存するまで、現在の共有表は変更されません。
                      </p>
                    )}
                  </div>
                  {isRecreating ? (
                    <button
                      type="button"
                      onClick={cancelRecreation}
                      className="rounded-lg border border-gray-300 bg-white text-gray-600 px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      作り直しをキャンセル
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingGenerationId(savedSchedule.generationId);
                        setConfirmingRevision(savedSchedule.revision);
                        setShowRecreateConfirm(true);
                        setRecreateConfirmation('');
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white text-amber-700 px-3 py-2 text-sm hover:bg-amber-50"
                    >
                      <RotateCcw size={15} /> 作り直す
                    </button>
                  )}
                </div>
              </div>
            )}

            {(!savedSchedule || isRecreating) && (
              <>
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
              onChange={(event) => { setMatchCount(event.target.value); setError(''); }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={createMatches}
            disabled={!selectedEventId || saving}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
          >
            <Shuffle size={18} />
            {saving ? '保存中...' : isRecreating ? '保存して作り直す' : '組み合わせ作成'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <UserCheck size={17} className="text-green-600" />
          <span className="text-gray-600">組み合わせ対象:</span>
          <strong className={selectedParticipants.length >= 4 ? 'text-green-700' : 'text-amber-600'}>
            {selectedParticipants.length}人
          </strong>
        </div>
              </>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3" role="alert">{error}</p>}
      </div>

      {matches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 bg-green-700 text-white flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">共有組み合わせ表</h2>
              <p className="text-[11px] text-green-100 mt-0.5">全端末へリアルタイム同期</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold">{completedCount} / {matches.length} 完了</p>
              <p className="text-[11px] text-green-100">{savedSchedule?.participantCount}人</p>
            </div>
          </div>
          <div className="h-2 bg-green-100">
            <div
              className="h-full bg-green-500 transition-[width]"
              style={{ width: `${matches.length ? (completedCount / matches.length) * 100 : 0}%` }}
            />
          </div>

          {/* スマホ: 2つのペアを上下に分けて名前を読みやすく表示 */}
          <div className="md:hidden divide-y divide-gray-100">
            {matches.map((match) => (
              <div key={match.number} className={`p-3 ${match.completed ? 'bg-green-50/70' : 'even:bg-gray-50/60'}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className={`text-xs font-bold ${match.completed ? 'text-green-700' : 'text-gray-500'}`}>
                    第{match.number}試合
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMatchCompleted(match)}
                    disabled={updatingMatchNumber !== null}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      match.completed
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-600 hover:border-green-400'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    {updatingMatchNumber === match.number ? '更新中...' : match.completed ? '完了済み' : '完了にする'}
                  </button>
                </div>
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
                  <th className="p-2.5 text-center w-28">進行</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.number} className={`border-t border-gray-100 ${
                    match.completed ? 'bg-green-50/70' : 'even:bg-gray-50/60'
                  }`}>
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
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleMatchCompleted(match)}
                        disabled={updatingMatchNumber !== null}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          match.completed
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:border-green-400'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        {updatingMatchNumber === match.number ? '更新中...' : match.completed ? '完了済み' : '完了'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showRecreateConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/40 overflow-y-auto overscroll-contain">
          <div className="min-h-full flex items-start md:items-center justify-center p-4 py-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-gray-800">組み合わせを作り直しますか？</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    現在の表と完了状況は、新しい表を保存するまで保持されます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecreateConfirm(false);
                    setConfirmingGenerationId(null);
                    setConfirmingRevision(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  aria-label="閉じる"
                >
                  <X size={20} />
                </button>
              </div>
              <label className="text-xs text-gray-600 block mb-1">
                確認のため「作り直す」と入力してください
              </label>
              <input
                type="text"
                value={recreateConfirmation}
                onChange={(event) => setRecreateConfirmation(event.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm"
                placeholder="作り直す"
                autoComplete="off"
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecreateConfirm(false);
                    setConfirmingGenerationId(null);
                    setConfirmingRevision(null);
                  }}
                  className="border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={beginRecreation}
                  disabled={recreateConfirmation !== '作り直す'}
                  className="bg-amber-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  作り直しを準備
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
