import { useEffect, useRef, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, X, Pencil, Trash2, Send, DollarSign, UserCheck, UserX, Users, CheckCircle } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, parseISO,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  getEvents, addEvent, updateEvent, deleteEvent,
  getExpenses, addExpense, updateExpense, deleteExpense,
  getAttendances, setAttendance, updateAttendance,
  getMembers,
} from "../../services/index";
import { sendLineMessage, buildEventMessage } from "../../services/line";
import { sendTeamsMessage, buildEventCard } from "../../services/teams";
import type { ClubEvent, ExpenseCategory, Attendance, AttendanceStatus, Member } from "../../types";

const EVENT_TYPE_LABELS: Record<string, string> = {
  practice: "練習", match: "試合", other: "その他",
};
const EVENT_TYPE_COLORS: Record<string, string> = {
  practice: "bg-blue-100 text-blue-700",
  match: "bg-red-100 text-red-700",
  other: "bg-gray-100 text-gray-700",
};
const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  court: "コート代", ball: "ボール代", equipment: "用具・備品",
  travel: "交通費", food: "飲食費", other: "その他",
};

const SAVED_NAME_KEY = "tennis_club_my_name";

const EMPTY_EVENT: Omit<ClubEvent, "id"> = {
  title: "", date: format(new Date(), "yyyy-MM-dd"),
  startTime: "09:00", endTime: "11:00",
  location: "", description: "", type: "practice",
  fee: 0, feeCategory: "court", feeDescription: "",
};

export default function SchedulePage() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // カレンダーポップアップ
  type PopupState = { date: Date; vx: number; vy: number; events: ClubEvent[] } | null;
  const [popup, setPopup] = useState<PopupState>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  // 参加登録パネル
  const [detailEvent, setDetailEvent] = useState<ClubEvent | null>(null);
  const [myName, setMyName] = useState(() => localStorage.getItem(SAVED_NAME_KEY) ?? "");
  const [myComment, setMyComment] = useState("");
  const [nameMode, setNameMode] = useState<"select" | "input">("select");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // 管理フォーム
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
  const [form, setForm] = useState<Omit<ClubEvent, "id">>(EMPTY_EVENT);
  const [loading, setLoading] = useState(true);
  const [notifyLine, setNotifyLine] = useState(true);
  const [notifyTeams, setNotifyTeams] = useState(true);

  useEffect(() => { loadAll(); }, []);

  // ポップアップ外クリックで閉じる（同一クリックで開いた直後に閉じないよう setTimeout）
  useEffect(() => {
    if (!popup) return;
    function onClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('click', onClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClickOutside);
    };
  }, [popup]);

  async function loadAll() {
    setLoading(true);
    try {
      const [ev, at, me] = await Promise.all([getEvents(), getAttendances(), getMembers()]);
      setEvents(ev); setAttendances(at); setMembers(me);
    } catch { setEvents([]); setAttendances([]); setMembers([]); }
    finally { setLoading(false); }
  }

  // ── 参加登録 ──────────────────────────────────

  function openDetail(event: ClubEvent) {
    setDetailEvent(event);
    setSubmitted(false);
    setMyComment("");
  }

  async function handleAttend(status: AttendanceStatus) {
    if (!detailEvent?.id || !myName.trim()) return;
    setSubmitting(true);
    localStorage.setItem(SAVED_NAME_KEY, myName.trim());
    const existing = attendances.find(
      (a) => a.eventId === detailEvent.id && a.memberName === myName.trim()
    );
    if (existing?.id) {
      await updateAttendance(existing.id, { status, comment: myComment.trim() || undefined });
    } else {
      await setAttendance({
        eventId: detailEvent.id,
        memberId: "",
        memberName: myName.trim(),
        status,
        comment: myComment.trim() || undefined,
      });
    }
    const fresh = await getAttendances();
    setAttendances(fresh);
    setSubmitting(false);
    setSubmitted(true);
  }

  function getEventAttendances(eventId: string) {
    return attendances.filter((a) => a.eventId === eventId);
  }

  function getMyStatus(eventId: string): AttendanceStatus | null {
    if (!myName.trim()) return null;
    return attendances.find(
      (a) => a.eventId === eventId && a.memberName === myName.trim()
    )?.status ?? null;
  }

  // ── 管理（追加・編集・削除） ───────────────────

  function openAddForm(date?: Date) {
    setEditingEvent(null);
    setForm({ ...EMPTY_EVENT, date: date ? format(date, "yyyy-MM-dd") : EMPTY_EVENT.date });
    setShowForm(true);
  }

  function openEditForm(event: ClubEvent) {
    setEditingEvent(event);
    const { id: _id, ...rest } = event;
    void _id;
    setForm(rest);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    async function syncExpense(eventId: string) {
      const expenses = await getExpenses();
      const linked = expenses.find((ex) => ex.eventId === eventId);
      const fee = form.fee ?? 0;
      if (fee > 0) {
        const expenseData = {
          eventId, date: form.date, category: form.feeCategory ?? "court",
          description: form.feeDescription?.trim() || `${form.title}（${form.location || "場所未定"}）`,
          amount: fee, paidBy: "",
        };
        if (linked?.id) await updateExpense(linked.id, expenseData);
        else await addExpense(expenseData);
      } else if (linked?.id) {
        await deleteExpense(linked.id);
      }
    }
    if (editingEvent?.id) {
      await updateEvent(editingEvent.id, form);
      await syncExpense(editingEvent.id);
      if (notifyLine) await sendLineMessage(buildEventMessage("updated", form.title, form.date, form.location));
      if (notifyTeams) { const c = buildEventCard("updated", form.title, form.date, form.location); await sendTeamsMessage(c.title, c.text, c.color); }
    } else {
      const newId = await addEvent(form);
      await syncExpense(newId);
      if (notifyLine) await sendLineMessage(buildEventMessage("added", form.title, form.date, form.location));
      if (notifyTeams) { const c = buildEventCard("added", form.title, form.date, form.location); await sendTeamsMessage(c.title, c.text, c.color); }
    }
    setShowForm(false);
    await loadAll();
  }

  async function handleDelete(event: ClubEvent) {
    if (!event.id || !window.confirm(`「${event.title}」を削除しますか？`)) return;
    const expenses = await getExpenses();
    const linked = expenses.find((ex) => ex.eventId === event.id);
    if (linked?.id) await deleteExpense(linked.id);
    await deleteEvent(event.id);
    if (notifyLine) await sendLineMessage(buildEventMessage("deleted", event.title, event.date, event.location));
    if (notifyTeams) { const c = buildEventCard("deleted", event.title, event.date, event.location); await sendTeamsMessage(c.title, c.text, c.color); }
    await loadAll();
  }

  // ── カレンダー描画 ────────────────────────────

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const eventsForDate = (date: Date) => events.filter((e) => isSameDay(parseISO(e.date), date));

  function openPopup(day: Date, e: React.MouseEvent) {
    const dayEvents = eventsForDate(day);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // ビューポート座標を保存（fixed 位置指定用）
    const vx = Math.min(rect.left, window.innerWidth - 296);
    const vy = Math.min(rect.bottom + 4, window.innerHeight - 340);
    setPopup({ date: day, vx, vy, events: dayEvents });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">スケジュール管理</h1>
        <button
          onClick={() => openAddForm()}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition"
        >
          <Plus size={16} /> イベント追加
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 relative" ref={calendarRef}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-gray-700">
            {format(currentMonth, "yyyy年 M月", { locale: ja })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-gray-500 border-b border-gray-100">
          {["日","月","火","水","木","金","土"].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: days[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 md:h-32" />
          ))}
          {days.map((day) => {
            const dayEvents = eventsForDate(day);
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                onClick={(e) => openPopup(day, e)}
                className={`h-24 md:h-32 border-b border-r border-gray-50 p-1 text-left transition-colors align-top ${
                  popup && isSameDay(day, popup.date) ? "bg-green-50" : "hover:bg-gray-50"
                } ${!isSameMonth(day, currentMonth) ? "opacity-40" : ""}`}
              >
                <span className={`text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full shrink-0 ${
                  isToday ? "bg-green-600 text-white" : "text-gray-700"
                }`}>
                  {format(day, "d")}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div key={ev.id} className={`text-xs rounded px-1 py-0.5 ${EVENT_TYPE_COLORS[ev.type]}`}>
                      <div className="font-medium truncate leading-tight">{ev.title}</div>
                      <div className="truncate leading-tight opacity-80">{ev.startTime}〜{ev.endTime}</div>
                      {ev.location && (
                        <div className="truncate leading-tight opacity-70 hidden md:block">📍 {ev.location}</div>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - 2}件</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PC: カレンダーポップアップ（fixed 位置） ── */}
      {popup && (
        <div
          ref={popupRef}
          className="hidden md:block fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-72 p-3"
          style={{ top: popup.vy, left: popup.vx }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700 text-sm">
              {format(popup.date, 'M月d日（E）', { locale: ja })}
            </span>
            <button onClick={() => setPopup(null)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <button
            onClick={() => { setPopup(null); openAddForm(popup.date); }}
            className="flex items-center gap-2 w-full text-sm text-green-700 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg font-medium transition mb-2"
          >
            <Plus size={15} /> イベントを追加
          </button>
          {popup.events.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400 mb-1">この日のイベント</p>
              {popup.events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-1 rounded-lg border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => { setPopup(null); openDetail(ev); }}
                    className="flex-1 text-left px-3 py-2 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[ev.type]}`}>
                        {EVENT_TYPE_LABELS[ev.type]}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">{ev.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{ev.startTime}〜{ev.endTime}{ev.location && ` ｜ ${ev.location}`}</p>
                  </button>
                  <button
                    onClick={() => { setPopup(null); openEditForm(ev); }}
                    className="px-2 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                    title="編集"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* モバイル: ボトムシートポップアップ */}
      {popup && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setPopup(null)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 pb-6 mx-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-gray-800">
                {format(popup.date, 'M月d日（E）', { locale: ja })}
              </span>
              <button onClick={() => setPopup(null)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <button
              onClick={() => { setPopup(null); openAddForm(popup.date); }}
              className="flex items-center justify-center gap-2 w-full text-sm text-white bg-green-600 hover:bg-green-700 px-4 py-3 rounded-xl font-semibold transition mb-3"
            >
              <Plus size={18} /> イベントを追加
            </button>
            {popup.events.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-1">この日のイベント</p>
                {popup.events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-1 rounded-xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => { setPopup(null); openDetail(ev); }}
                      className="flex-1 text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[ev.type]}`}>
                          {EVENT_TYPE_LABELS[ev.type]}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{ev.title}</span>
                      </div>
                      <p className="text-xs text-gray-400">{ev.startTime}〜{ev.endTime}{ev.location && ` ｜ ${ev.location}`}</p>
                    </button>
                    <button
                      onClick={() => { setPopup(null); openEditForm(ev); }}
                      className="px-4 py-3 text-gray-400 hover:text-blue-600 active:bg-blue-50 transition"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">今後のイベント</h2>
          {events.filter((e) => e.date >= format(new Date(), "yyyy-MM-dd")).length === 0 ? (
            <p className="text-gray-400 text-sm">イベントなし</p>
          ) : (
            <div className="space-y-2">
              {events
                .filter((e) => e.date >= format(new Date(), "yyyy-MM-dd"))
                .slice(0, 10)
                .map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    attendances={getEventAttendances(ev.id!)}
                    onOpen={openDetail}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── 参加登録パネル（モーダル） ── */}
      {detailEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            {/* ヘッダー */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[detailEvent.type]}`}>
                    {EVENT_TYPE_LABELS[detailEvent.type]}
                  </span>
                  {(detailEvent.fee ?? 0) > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                      ¥{(detailEvent.fee ?? 0).toLocaleString()}
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-gray-800 text-lg">{detailEvent.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  📅 {detailEvent.date} {detailEvent.startTime}〜{detailEvent.endTime}
                </p>
                {detailEvent.location && (
                  <p className="text-sm text-gray-500">📍 {detailEvent.location}</p>
                )}
                {detailEvent.description && (
                  <p className="text-xs text-gray-400 mt-1">{detailEvent.description}</p>
                )}
              </div>
              <button onClick={() => setDetailEvent(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* 参加状況サマリー */}
            <AttendanceSummary attendances={getEventAttendances(detailEvent.id!)} />

            {/* 参加登録フォーム */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">✋ 参加・不参加を登録</h3>
              {submitted ? (
                <SubmittedView
                  name={myName}
                  status={getMyStatus(detailEvent.id!)}
                  onReset={() => setSubmitted(false)}
                />
              ) : (
                <div className="space-y-3">
                  {/* 名前入力: 選択 or 直接入力 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">お名前</label>
                    <div className="flex gap-2 mb-1">
                      <button
                        onClick={() => setNameMode("select")}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${nameMode === "select" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-500 border-gray-300 hover:border-green-400"}`}
                      >
                        リストから選択
                      </button>
                      <button
                        onClick={() => setNameMode("input")}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${nameMode === "input" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-500 border-gray-300 hover:border-green-400"}`}
                      >
                        直接入力
                      </button>
                    </div>
                    {nameMode === "select" ? (
                      <select
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="">— 名前を選択 —</option>
                        {members.map((m) => (
                          <option key={m.id ?? m.name} value={m.name}>{m.name}{m.department ? `（${m.department}）` : ""}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="例: 田中 一郎"
                        value={myName}
                        onChange={(e) => setMyName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        autoComplete="name"
                      />
                    )}
                    {myName.trim() && nameMode === "input" && (
                      <p className="text-xs text-gray-400 mt-1">次回から自動入力されます</p>
                    )}
                  </div>
                  {/* コメント欄 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">コメント（任意）</label>
                    <input
                      type="text"
                      placeholder="例: 少し遅れます、道具持参します など"
                      value={myComment}
                      onChange={(e) => setMyComment(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      maxLength={100}
                    />
                  </div>
                  {/* 既存の回答表示 */}
                  {getMyStatus(detailEvent.id!) && (
                    <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                      getMyStatus(detailEvent.id!) === "attending"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {getMyStatus(detailEvent.id!) === "attending"
                        ? <UserCheck size={14} />
                        : <UserX size={14} />}
                      現在の回答: <strong>
                        {getMyStatus(detailEvent.id!) === "attending" ? "参加" : "不参加"}
                      </strong> — 変更する場合は下のボタンを押してください
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={!myName.trim() || submitting}
                      onClick={() => handleAttend("attending")}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <UserCheck size={18} /> 参加する
                    </button>
                    <button
                      disabled={!myName.trim() || submitting}
                      onClick={() => handleAttend("absent")}
                      className="flex items-center justify-center gap-2 bg-red-500 text-white py-3 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <UserX size={18} /> 不参加
                    </button>
                  </div>
                  {!myName.trim() && (
                    <p className="text-xs text-amber-600 text-center">名前を入力してください</p>
                  )}
                </div>
              )}
            </div>

            {/* 管理者操作 */}
            <div className="mt-4 border-t border-gray-100 pt-3 flex gap-2 justify-end">
              <button
                onClick={() => { setDetailEvent(null); openEditForm(detailEvent); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
              >
                <Pencil size={13} /> 編集
              </button>
              <button
                onClick={() => { setDetailEvent(null); handleDelete(detailEvent); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
              >
                <Trash2 size={13} /> 削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 管理フォームモーダル ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">{editingEvent ? "イベント編集" : "イベント追加"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input required type="text" placeholder="タイトル" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs text-gray-500">日付</label>
                  <input required type="date" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm min-w-0" />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500">種別</label>
                  <select value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as ClubEvent["type"] })}
                    className="w-full border rounded-lg px-3 py-2 text-sm min-w-0">
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs text-gray-500">開始</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-w-0" />
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-gray-500">終了</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm min-w-0" />
                </div>
              </div>
              <input type="text" placeholder="場所" value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="備考" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
              {/* 使用料金 */}
              <div className="bg-green-50 rounded-lg p-3 space-y-2 border border-green-100">
                <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <DollarSign size={12} /> 使用料金（経費に自動連携）
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="text-xs text-gray-500">金額 (円)</label>
                    <input type="number" min={0} value={form.fee ?? 0}
                      onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
                      className="w-full border rounded-lg px-3 py-2 text-sm min-w-0" />
                  </div>
                  <div className="min-w-0">
                    <label className="text-xs text-gray-500">カテゴリ</label>
                    <select value={form.feeCategory ?? "court"}
                      onChange={(e) => setForm({ ...form, feeCategory: e.target.value as ExpenseCategory })}
                      className="w-full border rounded-lg px-3 py-2 text-sm min-w-0"
                      disabled={(form.fee ?? 0) === 0}>
                      {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {(form.fee ?? 0) > 0 && (
                  <input type="text"
                    placeholder={`経費の説明（省略時: ${form.title || "タイトル"}（${form.location || "場所未定"}））`}
                    value={form.feeDescription ?? ""}
                    onChange={(e) => setForm({ ...form, feeDescription: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                )}
                {(form.fee ?? 0) === 0 && (
                  <p className="text-xs text-gray-400">金額を入力すると経費ページに自動追加されます</p>
                )}
              </div>
              {/* 通知 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Send size={12} /> 通知送信</p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={notifyLine} onChange={(e) => setNotifyLine(e.target.checked)} className="rounded" />
                  LINE に通知
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={notifyTeams} onChange={(e) => setNotifyTeams(e.target.checked)} className="rounded" />
                  Microsoft Teams に通知
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                  キャンセル
                </button>
                <button type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">
                  {editingEvent ? "更新" : "追加"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── サブコンポーネント ────────────────────────────────

function AttendanceSummary({ attendances }: { attendances: Attendance[] }) {
  const attending = attendances.filter((a) => a.status === "attending");
  const absent    = attendances.filter((a) => a.status === "absent");
  if (attendances.length === 0) return (
    <div className="text-xs text-gray-400 flex items-center gap-1"><Users size={13} /> まだ回答がありません</div>
  );
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm flex-wrap">
        <span className="flex items-center gap-1 text-green-700 font-medium">
          <UserCheck size={15} /> 参加 {attending.length}人
        </span>
        <span className="flex items-center gap-1 text-red-600 font-medium">
          <UserX size={15} /> 不参加 {absent.length}人
        </span>
      </div>
      {attending.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attending.map((a) => (
            <span key={a.id} title={a.comment || undefined} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              {a.memberName}
              {a.comment && <span className="text-green-500">💬</span>}
            </span>
          ))}
        </div>
      )}
      {absent.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {absent.map((a) => (
            <span key={a.id} title={a.comment || undefined} className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              {a.memberName}
              {a.comment && <span className="text-red-400">💬</span>}
            </span>
          ))}
        </div>
      )}
      {/* コメント一覧 */}
      {[...attending, ...absent].some(a => a.comment) && (
        <div className="mt-2 space-y-1">
          {[...attending, ...absent].filter(a => a.comment).map((a) => (
            <div key={a.id} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5 flex gap-2">
              <span className={`font-medium ${a.status === "attending" ? "text-green-700" : "text-red-600"}`}>{a.memberName}</span>
              <span className="text-gray-400">：</span>
              <span>{a.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmittedView({ name, status, onReset }: { name: string; status: AttendanceStatus | null; onReset: () => void }) {
  return (
    <div className="text-center py-4 space-y-3">
      <CheckCircle size={40} className={status === "attending" ? "text-green-500 mx-auto" : "text-red-400 mx-auto"} />
      <p className="font-semibold text-gray-800">
        {name} さん、<span className={status === "attending" ? "text-green-600" : "text-red-500"}>
          {status === "attending" ? "参加" : "不参加"}
        </span> で登録しました！
      </p>
      <button onClick={onReset} className="text-xs text-gray-400 underline">変更する</button>
    </div>
  );
}

function EventCard({
  event, attendances, onOpen, onEdit, onDelete,
}: {
  event: ClubEvent;
  attendances: Attendance[];
  onOpen: (e: ClubEvent) => void;
  onEdit: (e: ClubEvent) => void;
  onDelete: (e: ClubEvent) => void;
}) {
  const attending = attendances.filter((a) => a.status === "attending").length;
  const absent    = attendances.filter((a) => a.status === "absent").length;
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-green-300 transition cursor-pointer"
      onClick={() => onOpen(event)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${EVENT_TYPE_COLORS[event.type]}`}>
            {EVENT_TYPE_LABELS[event.type]}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">{event.title}</span>
          {(event.fee ?? 0) > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
              ¥{(event.fee ?? 0).toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {event.date} {event.startTime}〜{event.endTime}
          {event.location && ` ｜ ${event.location}`}
        </p>
        {attendances.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="text-green-600">✔ {attending}人参加</span>
            {absent > 0 && <span className="text-red-400">✘ {absent}人不参加</span>}
          </p>
        )}
      </div>
      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onEdit(event)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(event)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
