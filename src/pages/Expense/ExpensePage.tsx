import { useEffect, useState } from 'react';
import { Plus, X, Trash2, Pencil } from 'lucide-react';
import { getExpenses, addExpense, updateExpense, deleteExpense, getMembers } from '../../services/index';
import type { Expense, ExpenseCategory, Member } from '../../types';
import { format } from 'date-fns';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  court: 'コート代',
  ball: 'ボール代',
  equipment: '用具・備品',
  travel: '交通費',
  food: '飲食費',
  other: 'その他',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  court: 'bg-blue-100 text-blue-700',
  ball: 'bg-green-100 text-green-700',
  equipment: 'bg-purple-100 text-purple-700',
  travel: 'bg-orange-100 text-orange-700',
  food: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
};

const EMPTY_EXPENSE: Omit<Expense, 'id'> = {
  date: format(new Date(), 'yyyy-MM-dd'),
  category: 'court',
  description: '',
  amount: 0,
  paidBy: '',
};

export default function ExpensePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Omit<Expense, 'id'>>(EMPTY_EXPENSE);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [e, m] = await Promise.all([getExpenses(), getMembers()]);
    setExpenses(e);
    setMembers(m);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (editing?.id) {
      await updateExpense(editing.id, form);
    } else {
      await addExpense(form);
    }
    setShowForm(false);
    await load();
  }

  async function handleDelete(e: Expense) {
    if (!e.id || !window.confirm('この経費を削除しますか？')) return;
    await deleteExpense(e.id);
    await load();
  }

  const filteredExpenses = expenses.filter((e) => e.date.startsWith(filterMonth));
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // カテゴリ別集計
  const byCategory = (Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => ({
    cat,
    total: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0);

  // 按分計算
  const memberCount = members.length;
  const perPerson = memberCount > 0 ? Math.ceil(totalAmount / memberCount) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">経費計算</h1>
        <button
          onClick={() => { setEditing(null); setForm(EMPTY_EXPENSE); setShowForm(true); }}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
        >
          <Plus size={16} /> 経費追加
        </button>
      </div>

      {/* 月フィルター */}
      <div className="mb-4">
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">合計金額</p>
          <p className="text-2xl font-bold text-gray-800">¥{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">件数</p>
          <p className="text-2xl font-bold text-gray-800">{filteredExpenses.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <p className="text-xs text-gray-500 mb-1">1人あたり ({memberCount}人)</p>
          <p className="text-2xl font-bold text-green-700">¥{perPerson.toLocaleString()}</p>
        </div>
      </div>

      {/* カテゴリ別 */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">カテゴリ別内訳</h2>
          <div className="space-y-2">
            {byCategory.map(({ cat, total }) => (
              <div key={cat} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium w-24 text-center shrink-0 ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${totalAmount > 0 ? Math.round((total / totalAmount) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 w-20 text-right">¥{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 経費リスト */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">経費一覧</h2>
        {filteredExpenses.length === 0 ? (
          <p className="text-gray-400 text-sm">経費がありません</p>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-50 hover:border-gray-200 transition">
                <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${CATEGORY_COLORS[e.category]}`}>
                  {CATEGORY_LABELS[e.category]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                    {e.eventId && (
                      <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded shrink-0">
                        🔗 スケジュール連携
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{e.date}{e.paidBy ? ` ｜ 支払: ${e.paidBy}` : ''}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 shrink-0">¥{e.amount.toLocaleString()}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(e); setForm({ date: e.date, category: e.category, description: e.description, amount: e.amount, paidBy: e.paidBy, eventId: e.eventId }); setShowForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{editing ? '経費編集' : '経費追加'}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">日付</label>
                  <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">カテゴリ</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <input required type="text" placeholder="内容" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">金額 (円)</label>
                  <input required type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">支払者</label>
                  <select value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">選択</option>
                    {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">{editing ? '更新' : '追加'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
