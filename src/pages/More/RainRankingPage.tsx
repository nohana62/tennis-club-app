import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, CloudRain, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAttendances, getEvents, getMembers } from '../../services';
import type { Attendance, ClubEvent, Member } from '../../types';
import { buildRainRanking } from '../../utils/rainRanking';

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const currentYearStart = `${now.getFullYear()}-01`;

function rankStyle(rank: number): string {
  if (rank === 1) return 'bg-amber-100 text-amber-700';
  if (rank === 2) return 'bg-slate-200 text-slate-700';
  if (rank === 3) return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
}

export default function RainRankingPage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [fromMonth, setFromMonth] = useState(currentYearStart);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [eventData, memberData, attendanceData] = await Promise.all([
          getEvents(),
          getMembers(),
          getAttendances(),
        ]);
        setEvents(eventData);
        setMembers(memberData);
        setAttendances(attendanceData);
      } catch (loadError) {
        console.error('雨男・雨女ランキングの読み込みに失敗しました', loadError);
        setError('データを読み込めませんでした。通信状態を確認して再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const invalidPeriod = !fromMonth || !toMonth || fromMonth > toMonth;
  const result = useMemo(
    () => invalidPeriod
      ? { cancelledEventCount: 0, entries: [] }
      : buildRainRanking(events, attendances, members, fromMonth, toMonth),
    [attendances, events, fromMonth, invalidPeriod, members, toMonth],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/more" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 mb-4">
        <ChevronLeft size={16} /> その他へ戻る
      </Link>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CloudRain size={24} className="text-sky-600" /> 雨男・雨女ランキング
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          雨天中止になった予定で「参加」と回答していた回数を集計します。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">集計期間</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="min-w-0">
            <span className="text-xs text-gray-500 block mb-1">開始月</span>
            <input
              type="month"
              required
              value={fromMonth}
              onChange={(event) => setFromMonth(event.target.value)}
              className="w-full min-w-0 border rounded-lg px-2 py-2 text-sm bg-white"
            />
          </label>
          <span className="text-gray-400 pb-2">～</span>
          <label className="min-w-0">
            <span className="text-xs text-gray-500 block mb-1">終了月</span>
            <input
              type="month"
              required
              value={toMonth}
              onChange={(event) => setToMonth(event.target.value)}
              className="w-full min-w-0 border rounded-lg px-2 py-2 text-sm bg-white"
            />
          </label>
        </div>
        {invalidPeriod && (
          <p className="text-xs text-red-600 mt-2" role="alert">
            {!fromMonth || !toMonth ? '開始月と終了月を選択してください。' : '開始月は終了月以前にしてください。'}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 p-4">読み込み中...</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : !invalidPeriod && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-center">
              <CloudRain size={20} className="text-sky-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-sky-700">{result.cancelledEventCount}</p>
              <p className="text-xs text-sky-700">雨天中止の予定</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
              <Users size={20} className="text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700">{result.entries.length}</p>
              <p className="text-xs text-green-700">ランキング対象者</p>
            </div>
          </div>

          {result.cancelledEventCount === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500">
              <CloudRain size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">この期間に中止の予定はありません。</p>
            </div>
          ) : result.entries.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-500">
              <Users size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">中止予定に参加登録していた人はいません。</p>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {result.entries.map((entry) => (
                  <div key={entry.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${rankStyle(entry.rank)}`}>
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{entry.eventDates.join('、')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-sky-700">{entry.count}</p>
                      <p className="text-xs text-gray-500">回</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block bg-white border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-center p-3 w-24">順位</th>
                      <th className="text-left p-3">名前</th>
                      <th className="text-left p-3">中止日</th>
                      <th className="text-right p-3 w-28">回数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.entries.map((entry) => (
                      <tr key={entry.id} className="border-t border-gray-100">
                        <td className="p-3 text-center">
                          <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center font-bold ${rankStyle(entry.rank)}`}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-800">{entry.name}</td>
                        <td className="p-3 text-gray-500">{entry.eventDates.join('、')}</td>
                        <td className="p-3 text-right font-bold text-sky-700">{entry.count}回</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {!loading && !error && result.entries.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
          <Trophy size={13} /> 同じ回数の人は同順位です。
        </p>
      )}
    </div>
  );
}
