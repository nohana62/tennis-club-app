import { useEffect, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { getEvents, getMembers, getAttendances, getExpenses } from '../../services/index';
import type { ClubEvent, Member, Attendance, Expense } from '../../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const CATEGORY_LABELS: Record<string, string> = {
  court: 'コート代', ball: 'ボール代', equipment: '用具・備品',
  travel: '交通費', food: '飲食費', other: 'その他',
};

export default function ReportPage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ev, me, at, ex] = await Promise.all([getEvents(), getMembers(), getAttendances(), getExpenses()]);
      setEvents(ev); setMembers(me); setAttendances(at); setExpenses(ex);
      setLoading(false);
    })();
  }, []);

  const monthEvents = events.filter(e => e.date.startsWith(reportMonth));
  const monthExpenses = expenses.filter(e => e.date.startsWith(reportMonth));
  const totalExpense = monthExpenses.reduce((s, e) => s + e.amount, 0);

  // 参加率サマリー
  const attendanceSummary = members.map((m) => {
    const memberAttendances = attendances.filter(a => a.memberId === m.id);
    const monthEventIds = monthEvents.map(e => e.id);
    const monthAtt = memberAttendances.filter(a => monthEventIds.includes(a.eventId));
    const attending = monthAtt.filter(a => a.status === 'attending').length;
    return { name: m.name, department: m.department, attending, total: monthEvents.length };
  });

  function buildReportTitle() {
    return `テニス部 活動報告書 ${reportMonth.replace('-', '年')}月`;
  }

  async function exportPDF() {
    const title = buildReportTitle();
    const createdAt = format(new Date(), 'yyyy年M月d日', { locale: ja });

    const evRows = monthEvents.map(ev => `
      <tr>
        <td>${ev.date}</td>
        <td>${ev.title}</td>
        <td>${ev.type === 'practice' ? '練習' : ev.type === 'match' ? '試合' : 'その他'}</td>
        <td>${ev.startTime}〜${ev.endTime}</td>
        <td>${ev.location}</td>
      </tr>`).join('');

    const attRows = attendanceSummary.map(a => `
      <tr>
        <td>${a.name}</td>
        <td>${a.department ?? ''}</td>
        <td>${a.attending}</td>
        <td>${a.total}</td>
        <td>${a.total > 0 ? Math.round((a.attending / a.total) * 100) + '%' : '-'}</td>
      </tr>`).join('');

    const expRows = monthExpenses.map(e => `
      <tr>
        <td>${e.date}</td>
        <td>${CATEGORY_LABELS[e.category] ?? e.category}</td>
        <td>${e.description}</td>
        <td>¥${e.amount.toLocaleString()}</td>
        <td>${e.paidBy}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: "Hiragino Kaku Gothic Pro", "Meiryo", "MS PGothic", sans-serif; margin: 20mm; color: #111; }
  h1 { font-size: 18pt; margin-bottom: 4pt; }
  .meta { font-size: 10pt; color: #555; margin-bottom: 16pt; }
  h2 { font-size: 12pt; background: #166534; color: #fff; padding: 4pt 8pt; margin-top: 16pt; margin-bottom: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  th { background: #dcfce7; font-weight: bold; padding: 4pt 6pt; border: 1px solid #ccc; }
  td { padding: 4pt 6pt; border: 1px solid #ccc; }
  .total { text-align: right; font-weight: bold; color: #166534; font-size: 10pt; margin-top: 4pt; }
  @media print { @page { size: A4; margin: 15mm; } body { margin: 0; } }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">作成日: ${createdAt}</p>

<h2>1. イベント一覧 (${monthEvents.length}件)</h2>
<table>
  <tr><th>日付</th><th>タイトル</th><th>種別</th><th>時間</th><th>場所</th></tr>
  ${evRows || '<tr><td colspan="5" style="color:#999;text-align:center">イベントなし</td></tr>'}
</table>

<h2>2. 参加状況</h2>
<table>
  <tr><th>氏名</th><th>部署</th><th>参加回数</th><th>対象数</th><th>参加率</th></tr>
  ${attRows || '<tr><td colspan="5" style="color:#999;text-align:center">データなし</td></tr>'}
</table>

<h2>3. 経費明細</h2>
<table>
  <tr><th>日付</th><th>カテゴリ</th><th>内容</th><th>金額</th><th>支払者</th></tr>
  ${expRows || '<tr><td colspan="5" style="color:#999;text-align:center">経費なし</td></tr>'}
</table>
<p class="total">合計: ¥${totalExpense.toLocaleString()}</p>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, '_blank', 'width=900,height=700');
    if (!printWin) {
      alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。');
      URL.revokeObjectURL(url);
      return;
    }
    printWin.addEventListener('load', () => {
      setTimeout(() => {
        printWin.print();
        URL.revokeObjectURL(url);
      }, 500);
    });
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Events
    const evSheet = XLSX.utils.aoa_to_sheet([
      ['日付', 'タイトル', '種別', '開始', '終了', '場所', '備考'],
      ...monthEvents.map(ev => [
        ev.date, ev.title,
        ev.type === 'practice' ? '練習' : ev.type === 'match' ? '試合' : 'その他',
        ev.startTime, ev.endTime, ev.location, ev.description,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, evSheet, 'イベント');

    // Sheet 2: Attendance
    const attSheet = XLSX.utils.aoa_to_sheet([
      ['氏名', '部署', '参加回数', '対象イベント数', '参加率'],
      ...attendanceSummary.map(a => [
        a.name, a.department, a.attending, a.total,
        a.total > 0 ? `${Math.round((a.attending / a.total) * 100)}%` : '-',
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, attSheet, '参加状況');

    // Sheet 3: Expenses
    const expSheet = XLSX.utils.aoa_to_sheet([
      ['日付', 'カテゴリ', '内容', '金額', '支払者'],
      ...monthExpenses.map(e => [
        e.date, CATEGORY_LABELS[e.category] ?? e.category, e.description, e.amount, e.paidBy,
      ]),
      ['', '', '合計', totalExpense, ''],
    ]);
    XLSX.utils.book_append_sheet(wb, expSheet, '経費明細');

    XLSX.writeFile(wb, `テニス部報告書_${reportMonth}.xlsx`);
  }

  if (loading) return <div className="text-gray-400 text-sm p-4">読み込み中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">報告書作成</h1>
      </div>

      {/* Month selector */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 mb-1 block">対象月</label>
        <input
          type="month"
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{buildReportTitle()}</h2>
          <p className="text-xs text-gray-500">作成日: {format(new Date(), 'yyyy年M月d日', { locale: ja })}</p>
        </div>

        {/* Events summary */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">1. イベント一覧</h3>
          {monthEvents.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-50">
                  <th className="text-left p-2 border border-gray-100">日付</th>
                  <th className="text-left p-2 border border-gray-100">タイトル</th>
                  <th className="text-left p-2 border border-gray-100">種別</th>
                  <th className="text-left p-2 border border-gray-100">場所</th>
                </tr>
              </thead>
              <tbody>
                {monthEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-100">{ev.date}</td>
                    <td className="p-2 border border-gray-100">{ev.title}</td>
                    <td className="p-2 border border-gray-100">{ev.type === 'practice' ? '練習' : ev.type === 'match' ? '試合' : 'その他'}</td>
                    <td className="p-2 border border-gray-100">{ev.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Attendance summary */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">2. 参加状況</h3>
          {attendanceSummary.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-50">
                  <th className="text-left p-2 border border-gray-100">氏名</th>
                  <th className="text-left p-2 border border-gray-100">部署</th>
                  <th className="text-right p-2 border border-gray-100">参加回数</th>
                  <th className="text-right p-2 border border-gray-100">参加率</th>
                </tr>
              </thead>
              <tbody>
                {attendanceSummary.map((a) => (
                  <tr key={a.name} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-100">{a.name}</td>
                    <td className="p-2 border border-gray-100">{a.department}</td>
                    <td className="p-2 border border-gray-100 text-right">{a.attending} / {a.total}</td>
                    <td className="p-2 border border-gray-100 text-right font-medium text-green-700">
                      {a.total > 0 ? `${Math.round((a.attending / a.total) * 100)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Expense summary */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">3. 経費明細</h3>
          {monthExpenses.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <>
              <table className="w-full text-xs border-collapse mb-2">
                <thead>
                  <tr className="bg-green-50">
                    <th className="text-left p-2 border border-gray-100">日付</th>
                    <th className="text-left p-2 border border-gray-100">カテゴリ</th>
                    <th className="text-left p-2 border border-gray-100">内容</th>
                    <th className="text-right p-2 border border-gray-100">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {monthExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="p-2 border border-gray-100">{e.date}</td>
                      <td className="p-2 border border-gray-100">{CATEGORY_LABELS[e.category]}</td>
                      <td className="p-2 border border-gray-100">{e.description}</td>
                      <td className="p-2 border border-gray-100 text-right">¥{e.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-green-50 font-bold">
                    <td colSpan={3} className="p-2 border border-gray-100 text-right">合計</td>
                    <td className="p-2 border border-gray-100 text-right text-green-700">¥{totalExpense.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {/* Download buttons */}
      <div className="flex gap-3">
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm hover:bg-red-700 transition flex-1 justify-center"
        >
          <FileText size={18} /> PDF ダウンロード
        </button>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm hover:bg-emerald-700 transition flex-1 justify-center"
        >
          <FileDown size={18} /> Excel ダウンロード
        </button>
      </div>
    </div>
  );
}
