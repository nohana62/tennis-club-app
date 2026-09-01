import { useEffect, useRef, useState } from 'react';
import { Plus, X, Trash2, AlertTriangle, Bell } from 'lucide-react';
import { getPosts, addPost, deletePost } from '../../services/index';
import { sendTeamsMessage } from '../../services/teams';
import { sendLineMessage } from '../../services/line';
import type { Post } from '../../types';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function BoardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);
  const [notifyLine, setNotifyLine] = useState(false);
  const [notifyTeams, setNotifyTeams] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const p = await getPosts();
    setPosts(p);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;
    setSubmitting(true);
    await addPost({ authorName: authorName.trim(), content: content.trim(), important });

    // 重要フラグONのみ通知
    if (important) {
      const title = `📢【重要】${authorName}さんからの投稿`;
      const body = content.trim();
      if (notifyTeams) await sendTeamsMessage(title, body, 'ef4444');
      if (notifyLine) await sendLineMessage(`【テニス部 重要掲示板】\n${authorName}さん:\n${body}`);
    }

    setAuthorName('');
    setContent('');
    setImportant(false);
    setNotifyLine(false);
    setNotifyTeams(false);
    setShowForm(false);
    setSubmitting(false);
    await load();
  }

  async function handleDelete(post: Post) {
    if (!post.id || !window.confirm('この投稿を削除しますか？')) return;
    await deletePost(post.id);
    await load();
  }

  function formatDate(iso?: string) {
    if (!iso) return '';
    try { return format(parseISO(iso), 'yyyy/MM/dd HH:mm', { locale: ja }); } catch { return iso; }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">掲示板</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
        >
          <Plus size={16} /> 投稿する
        </button>
      </div>

      {/* 投稿一覧 */}
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
          投稿がありません。最初の投稿をしてみましょう！
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`bg-white rounded-xl border p-4 ${post.important ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {post.important && (
                    <span className="flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                      <AlertTriangle size={11} /> 重要
                    </span>
                  )}
                  <span className="font-semibold text-gray-800 text-sm">{post.authorName}</span>
                  <span className="text-xs text-gray-400">{formatDate(post.createdAt)}</span>
                </div>
                <button
                  onClick={() => handleDelete(post)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* 投稿フォームモーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">掲示板に投稿</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 pb-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">名前 *</label>
                <input
                  required
                  type="text"
                  placeholder="投稿者名"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">内容 *</label>
                <textarea
                  ref={contentRef}
                  required
                  placeholder="投稿内容を入力..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* 重要フラグ */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={important}
                  onChange={(e) => setImportant(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <AlertTriangle size={14} className="text-red-500" /> 重要な投稿としてマーク
                </span>
              </label>

              {/* 通知（重要フラグON時のみ表示） */}
              {important && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Bell size={12} /> 重要投稿の通知先（設定済みのもののみ有効）
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyLine} onChange={(e) => setNotifyLine(e.target.checked)} className="w-4 h-4 accent-green-600" />
                    <span className="text-sm text-gray-700">💚 LINE に通知</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyTeams} onChange={(e) => setNotifyTeams(e.target.checked)} className="w-4 h-4 accent-purple-600" />
                    <span className="text-sm text-gray-700">💬 Teams に通知</span>
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-40"
                >
                  {submitting ? '投稿中...' : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
