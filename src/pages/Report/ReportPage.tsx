import { useEffect, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { getEvents, getMembers, getAttendances, getExpenses } from '../../services/index';
import type { ClubEvent, Member, Attendance, Expense } from '../../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import ExcelJS from 'exceljs';

const CATEGORY_LABELS: Record<string, string> = {
  court: 'コート代', ball: 'ボール代', equipment: '用具・備品',
  travel: '交通費', food: '飲食費', other: 'その他',
};
const EVENT_TYPE_LABELS: Record<string, string> = {
  practice: '練習', match: '試合', other: 'その他',
};
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];

type ReportMode = 'monthly' | 'yearly';

export default function ReportPage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mode, setMode] = useState<ReportMode>('monthly');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ev, me, at, ex] = await Promise.all([getEvents(), getMembers(), getAttendances(), getExpenses()]);
      setEvents(ev); setMembers(me); setAttendances(at); setExpenses(ex);
      setLoading(false);
    })();
  }, []);

  // ── 対象データ ──────────────────────────────────────────
  const prefix = mode === 'monthly' ? reportMonth : reportYear;
  const filteredEvents = events.filter(e => e.date.startsWith(prefix));
  const filteredExpenses = expenses.filter(e => e.date.startsWith(prefix));
  const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // 年間: 月別集計
  const monthlyStats = mode === 'yearly' ? MONTHS.map(m => {
    const ym = `${reportYear}-${m}`;
    const evs = events.filter(e => e.date.startsWith(ym));
    const exs = expenses.filter(e => e.date.startsWith(ym));
    return { month: `${parseInt(m)}月`, events: evs.length, expense: exs.reduce((s, e) => s + e.amount, 0) };
  }) : [];

  // 参加率サマリー
  const attendanceSummary = members.map((m) => {
    const targetEventIds = filteredEvents.map(e => e.id!);
    const memberAtts = attendances.filter(a => a.memberId === m.id && targetEventIds.includes(a.eventId));
    const attending = memberAtts.filter(a => a.status === 'attending').length;
    return { name: m.name, department: m.department, attending, total: filteredEvents.length };
  });

  function buildTitle() {
    if (mode === 'monthly') return `テニス部 活動報告書 ${reportMonth.replace('-', '年')}月`;
    return `テニス部 年間活動報告書 ${reportYear}年`;
  }

  // ── PDF出力 ─────────────────────────────────────────────
  async function exportPDF() {
    const title = buildTitle();
    const createdAt = format(new Date(), 'yyyy年M月d日', { locale: ja });

    const evRows = filteredEvents.map(ev => `
      <tr>
        <td>${ev.date}</td><td>${ev.title}</td>
        <td>${EVENT_TYPE_LABELS[ev.type] ?? ev.type}</td>
        <td>${ev.startTime}〜${ev.endTime}</td><td>${ev.location}</td>
      </tr>`).join('');

    const attRows = attendanceSummary.map(a => `
      <tr>
        <td>${a.name}</td><td>${a.department ?? ''}</td>
        <td>${a.attending}</td><td>${a.total}</td>
        <td>${a.total > 0 ? Math.round((a.attending / a.total) * 100) + '%' : '-'}</td>
      </tr>`).join('');

    const expRows = filteredExpenses.map(e => `
      <tr>
        <td>${e.date}</td><td>${CATEGORY_LABELS[e.category] ?? e.category}</td>
        <td>${e.description}</td><td>¥${e.amount.toLocaleString()}</td><td>${e.paidBy}</td>
      </tr>`).join('');

    const yearlySection = mode === 'yearly' ? `
      <h2>0. 月別サマリー</h2>
      <table>
        <tr><th>月</th><th>イベント数</th><th>経費合計</th></tr>
        ${monthlyStats.filter(s => s.events > 0 || s.expense > 0).map(s =>
          `<tr><td>${s.month}</td><td>${s.events}件</td><td>¥${s.expense.toLocaleString()}</td></tr>`
        ).join('')}
        <tr style="font-weight:bold;background:#dcfce7"><td>合計</td><td>${filteredEvents.length}件</td><td>¥${totalExpense.toLocaleString()}</td></tr>
      </table>` : '';

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:"Hiragino Kaku Gothic Pro","Meiryo","MS PGothic",sans-serif;margin:20mm;color:#111}
  h1{font-size:18pt;margin-bottom:4pt}
  .meta{font-size:10pt;color:#555;margin-bottom:16pt}
  h2{font-size:12pt;background:#166534;color:#fff;padding:4pt 8pt;margin-top:16pt;margin-bottom:0}
  table{border-collapse:collapse;width:100%;font-size:9pt}
  th{background:#dcfce7;font-weight:bold;padding:4pt 6pt;border:1px solid #ccc}
  td{padding:4pt 6pt;border:1px solid #ccc}
  .total{text-align:right;font-weight:bold;color:#166534;font-size:10pt;margin-top:4pt}
  @media print{@page{size:A4;margin:15mm}body{margin:0}}
</style></head><body>
<h1>${title}</h1><p class="meta">作成日: ${createdAt}</p>
${yearlySection}
<h2>${mode === 'yearly' ? '1.' : '1.'} イベント一覧 (${filteredEvents.length}件)</h2>
<table><tr><th>日付</th><th>タイトル</th><th>種別</th><th>時間</th><th>場所</th></tr>
  ${evRows || '<tr><td colspan="5" style="color:#999;text-align:center">データなし</td></tr>'}
</table>
<h2>2. 参加状況</h2>
<table><tr><th>氏名</th><th>部署</th><th>参加回数</th><th>対象数</th><th>参加率</th></tr>
  ${attRows || '<tr><td colspan="5" style="color:#999;text-align:center">データなし</td></tr>'}
</table>
<h2>3. 経費明細</h2>
<table><tr><th>日付</th><th>カテゴリ</th><th>内容</th><th>金額</th><th>支払者</th></tr>
  ${expRows || '<tr><td colspan="5" style="color:#999;text-align:center">データなし</td></tr>'}
</table>
<p class="total">合計: ¥${totalExpense.toLocaleString()}</p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank', 'width=900,height=700');
    if (!win) { alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。'); URL.revokeObjectURL(url); return; }
    win.addEventListener('load', () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500); });
  }

  // ── Excel出力（exceljs 1シート スタイル付き） ───────────────
  async function exportExcel() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'テニス部管理アプリ';
    const ws = wb.addWorksheet('報告書');

    // 列幅設定
    ws.columns = [
      { width: 14 }, { width: 28 }, { width: 12 }, { width: 16 }, { width: 20 },
    ];

    const GREEN_DARK = '166534';
    const GREEN_LIGHT = 'DCFCE7';
    const GREEN_MID = '86EFAC';
    const GRAY_LIGHT = 'F9FAFB';

    function addTitle(text: string) {
      const row = ws.addRow([text]);
      ws.mergeCells(`A${row.number}:E${row.number}`);
      const cell = row.getCell(1);
      cell.font = { bold: true, size: 16, color: { argb: 'FF' + GREEN_DARK } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      row.height = 28;
    }

    function addMeta(text: string) {
      const row = ws.addRow([text]);
      ws.mergeCells(`A${row.number}:E${row.number}`);
      row.getCell(1).font = { size: 9, color: { argb: 'FF888888' } };
      ws.addRow([]);
    }

    function addSectionHeader(text: string) {
      ws.addRow([]);
      const row = ws.addRow([text]);
      ws.mergeCells(`A${row.number}:E${row.number}`);
      const cell = row.getCell(1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_DARK } };
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      row.height = 22;
    }

    function addTableHeader(headers: string[]) {
      const row = ws.addRow(headers);
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_LIGHT } };
        cell.font = { bold: true, size: 9 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      row.height = 18;
    }

    function addDataRow(values: (string | number)[], isAlt = false) {
      const row = ws.addRow(values);
      row.eachCell((cell) => {
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      row.height = 16;
      return row;
    }

    function addTotalRow(label: string, amount: number, cols: number) {
      const vals: (string | number)[] = Array(cols).fill('');
      vals[cols - 2] = label;
      vals[cols - 1] = `¥${amount.toLocaleString()}`;
      const row = ws.addRow(vals);
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_LIGHT } };
        cell.font = { bold: true, size: 9, color: { argb: 'FF' + GREEN_DARK } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
      row.height = 16;
    }

    // ── タイトル
    addTitle(buildTitle());
    addMeta(`作成日: ${format(new Date(), 'yyyy年M月d日', { locale: ja })}`);

    // ── 年間: 月別サマリー
    if (mode === 'yearly') {
      addSectionHeader('0. 月別サマリー');
      addTableHeader(['月', 'イベント数', '経費合計', '', '']);
      monthlyStats.forEach((s, i) => {
        addDataRow([s.month, `${s.events}件`, `¥${s.expense.toLocaleString()}`, '', ''], i % 2 === 1);
      });
      const totalRow = ws.addRow(['合計', `${filteredEvents.length}件`, `¥${totalExpense.toLocaleString()}`, '', '']);
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + GREEN_MID } };
        cell.font = { bold: true, size: 9 };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      totalRow.height = 16;
    }

    // ── 1. イベント一覧
    addSectionHeader(`1. イベント一覧 (${filteredEvents.length}件)`);
    addTableHeader(['日付', 'タイトル', '種別', '時間', '場所']);
    if (filteredEvents.length === 0) {
      const r = ws.addRow(['データなし', '', '', '', '']);
      ws.mergeCells(`A${r.number}:E${r.number}`);
      r.getCell(1).font = { size: 9, color: { argb: 'FF999999' } };
      r.getCell(1).alignment = { horizontal: 'center' };
    } else {
      filteredEvents.forEach((ev, i) => {
        const r = addDataRow([ev.date, ev.title, EVENT_TYPE_LABELS[ev.type] ?? ev.type, `${ev.startTime}〜${ev.endTime}`, ev.location], i % 2 === 1);
        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    // ── 2. 参加状況
    addSectionHeader('2. 参加状況');
    addTableHeader(['氏名', '部署', '参加回数', '対象数', '参加率']);
    if (attendanceSummary.length === 0) {
      const r = ws.addRow(['データなし', '', '', '', '']);
      ws.mergeCells(`A${r.number}:E${r.number}`);
      r.getCell(1).font = { size: 9, color: { argb: 'FF999999' } };
      r.getCell(1).alignment = { horizontal: 'center' };
    } else {
      attendanceSummary.forEach((a, i) => {
        const rate = a.total > 0 ? `${Math.round((a.attending / a.total) * 100)}%` : '-';
        const r = addDataRow([a.name, a.department ?? '', a.attending, a.total, rate], i % 2 === 1);
        r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(5).font = { bold: true, size: 9, color: { argb: 'FF' + GREEN_DARK } };
      });
    }

    // ── 3. 経費明細
    addSectionHeader('3. 経費明細');
    addTableHeader(['日付', 'カテゴリ', '内容', '金額', '支払者']);
    if (filteredExpenses.length === 0) {
      const r = ws.addRow(['データなし', '', '', '', '']);
      ws.mergeCells(`A${r.number}:E${r.number}`);
      r.getCell(1).font = { size: 9, color: { argb: 'FF999999' } };
      r.getCell(1).alignment = { horizontal: 'center' };
    } else {
      filteredExpenses.forEach((e, i) => {
        const r = addDataRow([e.date, CATEGORY_LABELS[e.category] ?? e.category, e.description, `¥${e.amount.toLocaleString()}`, e.paidBy], i % 2 === 1);
        r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        r.getCell(4).font = { size: 9 };
      });
      addTotalRow('合計', totalExpense, 5);
    }

    // ── ダウンロード
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `テニス部報告書_${prefix}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="text-gray-400 text-sm p-4">読み込み中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">報告書作成</h1>
      </div>

      {/* モード切り替え */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {(['monthly', 'yearly'] as ReportMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${mode === m ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {m === 'monthly' ? '月間' : '年間'}
          </button>
        ))}
      </div>

      {/* 期間選択 */}
      <div className="mb-4">
        {mode === 'monthly' ? (
          <>
            <label className="text-xs text-gray-500 mb-1 block">対象月</label>
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
          </>
        ) : (
          <>
            <label className="text-xs text-gray-500 mb-1 block">対象年</label>
            <input type="number" min="2020" max="2099" value={reportYear} onChange={(e) => setReportYear(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-28" />
          </>
        )}
      </div>

      {/* プレビュー */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{buildTitle()}</h2>
          <p className="text-xs text-gray-500">作成日: {format(new Date(), 'yyyy年M月d日', { locale: ja })}</p>
        </div>

        {/* 年間: 月別サマリー */}
        {mode === 'yearly' && (
          <section>
            <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">0. 月別サマリー</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-green-50">
                  <th className="text-left p-2 border border-gray-100">月</th>
                  <th className="text-right p-2 border border-gray-100">イベント数</th>
                  <th className="text-right p-2 border border-gray-100">経費合計</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStats.map((s) => (
                  <tr key={s.month} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-100">{s.month}</td>
                    <td className="p-2 border border-gray-100 text-right">{s.events}件</td>
                    <td className="p-2 border border-gray-100 text-right">¥{s.expense.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="p-2 border border-gray-100">合計</td>
                  <td className="p-2 border border-gray-100 text-right">{filteredEvents.length}件</td>
                  <td className="p-2 border border-gray-100 text-right text-green-700">¥{totalExpense.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* イベント一覧 */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">1. イベント一覧</h3>
          {filteredEvents.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-green-50">
                <th className="text-left p-2 border border-gray-100">日付</th>
                <th className="text-left p-2 border border-gray-100">タイトル</th>
                <th className="text-left p-2 border border-gray-100">種別</th>
                <th className="text-left p-2 border border-gray-100">場所</th>
              </tr></thead>
              <tbody>
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-100">{ev.date}</td>
                    <td className="p-2 border border-gray-100">{ev.title}</td>
                    <td className="p-2 border border-gray-100">{EVENT_TYPE_LABELS[ev.type] ?? ev.type}</td>
                    <td className="p-2 border border-gray-100">{ev.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 参加状況 */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">2. 参加状況</h3>
          {attendanceSummary.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-green-50">
                <th className="text-left p-2 border border-gray-100">氏名</th>
                <th className="text-left p-2 border border-gray-100">部署</th>
                <th className="text-right p-2 border border-gray-100">参加回数</th>
                <th className="text-right p-2 border border-gray-100">参加率</th>
              </tr></thead>
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

        {/* 経費明細 */}
        <section>
          <h3 className="font-semibold text-gray-700 mb-2 text-sm border-l-4 border-green-600 pl-2">3. 経費明細</h3>
          {filteredExpenses.length === 0 ? <p className="text-gray-400 text-sm">データなし</p> : (
            <table className="w-full text-xs border-collapse mb-2">
              <thead><tr className="bg-green-50">
                <th className="text-left p-2 border border-gray-100">日付</th>
                <th className="text-left p-2 border border-gray-100">カテゴリ</th>
                <th className="text-left p-2 border border-gray-100">内容</th>
                <th className="text-right p-2 border border-gray-100">金額</th>
              </tr></thead>
              <tbody>
                {filteredExpenses.map((e) => (
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
          )}
        </section>
      </div>

      {/* ダウンロードボタン */}
      <div className="flex gap-3">
        <button onClick={exportPDF} className="flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl text-sm hover:bg-red-700 transition flex-1 justify-center">
          <FileText size={18} /> PDF ダウンロード
        </button>
        <button onClick={exportExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm hover:bg-emerald-700 transition flex-1 justify-center">
          <FileDown size={18} /> Excel ダウンロード
        </button>
      </div>
    </div>
  );
}
