import { useEffect, useState } from 'react';
import { Save, Send, CheckCircle, AlertTriangle, ExternalLink, Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import { sendTeamsMessage } from '../../services/teams';
import { sendLineMessage } from '../../services/line';
import { getAppConfig, saveAppConfig } from '../../services/index';
import type { AppConfig } from '../../services/index';

const DEFAULT_CONFIG: AppConfig = {
  expensePassword: 'tennis123',
  teamsWebhookUrl: '',
  lineToken: '',
  lineGroupId: '',
};

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showLineToken, setShowLineToken] = useState(false);
  const [teamsTestState, setTeamsTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [lineTestState, setLineTestState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  // パスワード変更
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getAppConfig().then((c) => { setConfig(c); setLoading(false); });
  }, []);

  async function handleSave() {
    await saveAppConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function testTeams() {
    if (!config.teamsWebhookUrl) return;
    await saveAppConfig({ teamsWebhookUrl: config.teamsWebhookUrl });
    setTeamsTestState('sending');
    try {
      await sendTeamsMessage(
        'テスト通知',
        '**テニス部管理アプリ** からのテスト送信です。\n\n設定が正常に完了しています ✅',
        '00a550'
      );
      setTeamsTestState('ok');
    } catch {
      setTeamsTestState('error');
    }
    setTimeout(() => setTeamsTestState('idle'), 4000);
  }

  async function testLine() {
    if (!config.lineToken || !config.lineGroupId) return;
    await saveAppConfig({ lineToken: config.lineToken, lineGroupId: config.lineGroupId });
    setLineTestState('sending');
    try {
      await sendLineMessage('【テニス部】テスト通知\n\n設定が完了しました ✅');
      setLineTestState('ok');
    } catch {
      setLineTestState('error');
    }
    setTimeout(() => setLineTestState('idle'), 4000);
  }

  async function handleChangePassword() {
    if (pwCurrent !== config.expensePassword) {
      setPwMessage({ type: 'error', text: '現在のパスワードが違います' });
      return;
    }
    if (pwNew.length < 4) {
      setPwMessage({ type: 'error', text: 'パスワードは4文字以上にしてください' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMessage({ type: 'error', text: '新しいパスワードが一致しません' });
      return;
    }
    await saveAppConfig({ expensePassword: pwNew });
    setConfig((c) => ({ ...c, expensePassword: pwNew }));
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPwMessage({ type: 'ok', text: 'パスワードを変更しました（全デバイスに反映）' });
    setTimeout(() => setPwMessage(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <Loader2 size={18} className="animate-spin" /> 設定を読み込み中...
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">通知設定</h1>
      <p className="text-sm text-gray-500 mb-6">
        設定はデータベースに保存され、全デバイスで共有されます。
      </p>

      {/* ── Microsoft Teams ── */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center text-lg">💬</div>
          <div>
            <h2 className="font-semibold text-gray-800">Microsoft Teams</h2>
            <p className="text-xs text-gray-500">Incoming Webhook 経由でチャンネルに通知</p>
          </div>
          <div className="ml-auto">
            <StatusBadge hasValue={!!config.teamsWebhookUrl} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Incoming Webhook URL</label>
            <input
              type="url"
              placeholder="https://xxx.webhook.office.com/webhookb2/..."
              value={config.teamsWebhookUrl}
              onChange={(e) => setConfig({ ...config, teamsWebhookUrl: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <details className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-gray-600 select-none">Webhook URL の取得方法</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>Teams で通知を送りたいチャンネルを開く</li>
              <li>チャンネル名の右の「…」→「コネクタ」をクリック</li>
              <li>「Incoming Webhook」→「構成」をクリック</li>
              <li>名前（例: テニス部）を入力して「作成」</li>
              <li>表示された URL をコピーして上の欄に貼り付け</li>
            </ol>
            <a href="https://learn.microsoft.com/ja-jp/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline">
              Microsoft 公式ドキュメント <ExternalLink size={11} />
            </a>
          </details>
          <button onClick={testTeams} disabled={!config.teamsWebhookUrl || teamsTestState === 'sending'} className="flex items-center gap-2 text-sm px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <Send size={14} />{teamsTestState === 'sending' ? '送信中...' : 'テスト送信'}
          </button>
          <TestResult state={teamsTestState} />
        </div>
      </section>

      {/* ── LINE ── */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center text-lg">💚</div>
          <div>
            <h2 className="font-semibold text-gray-800">LINE</h2>
            <p className="text-xs text-gray-500">Messaging API でグループに通知</p>
          </div>
          <div className="ml-auto">
            <StatusBadge hasValue={!!(config.lineToken && config.lineGroupId)} />
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-semibold">注意: CORS 制限について</p>
            <p className="mt-0.5">LINE API はブラウザから直接呼び出すと CORS エラーになります。本番環境では <strong>Firebase Functions</strong> などのサーバーサイドプロキシが必要です。</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">チャンネルアクセストークン</label>
            <div className="relative">
              <input
                type={showLineToken ? 'text' : 'password'}
                placeholder="チャンネルアクセストークンを貼り付け"
                value={config.lineToken}
                onChange={(e) => setConfig({ ...config, lineToken: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono pr-10"
              />
              <button type="button" onClick={() => setShowLineToken(!showLineToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showLineToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">送信先グループID / ユーザーID</label>
            <input type="text" placeholder="C... または U..." value={config.lineGroupId} onChange={(e) => setConfig({ ...config, lineGroupId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
          <button onClick={testLine} disabled={!config.lineToken || !config.lineGroupId || lineTestState === 'sending'} className="flex items-center gap-2 text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <Send size={14} />{lineTestState === 'sending' ? '送信中...' : 'テスト送信（プロキシ必要）'}
          </button>
          <TestResult state={lineTestState} />
        </div>
      </section>

      {/* ── 経費パスワード変更 ── */}
      <section className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Lock size={18} className="text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">経費編集パスワード</h2>
            <p className="text-xs text-gray-500">変更するとデータベースに保存され全デバイスに反映されます（初期値: tennis123）</p>
          </div>
        </div>
        <div className="space-y-2">
          {(['現在のパスワード', '新しいパスワード', '新しいパスワード（確認）'] as const).map((label, i) => {
            const val = [pwCurrent, pwNew, pwConfirm][i];
            const setter = [setPwCurrent, setPwNew, setPwConfirm][i];
            return (
              <div key={label}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={val}
                    onChange={(e) => { setter(e.target.value); setPwMessage(null); }}
                    className="w-full border rounded-lg px-3 py-2 text-sm pr-10"
                    placeholder="••••••••"
                  />
                  {i === 0 && (
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {pwMessage && (
            <p className={`text-xs flex items-center gap-1 ${pwMessage.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {pwMessage.type === 'ok' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              {pwMessage.text}
            </p>
          )}
          <button onClick={handleChangePassword} className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition">
            <Lock size={14} /> パスワードを変更
          </button>
        </div>
      </section>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition w-full justify-center ${saved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
      >
        {saved ? <><CheckCircle size={16} /> 保存しました！（全デバイスに反映）</> : <><Save size={16} /> 設定を保存</>}
      </button>
    </div>
  );
}

function StatusBadge({ hasValue }: { hasValue: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasValue ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {hasValue ? '✓ 設定済み' : '未設定'}
    </span>
  );
}

function TestResult({ state }: { state: 'idle' | 'sending' | 'ok' | 'error' }) {
  if (state === 'idle') return null;
  if (state === 'sending') return <p className="text-xs text-gray-500">送信中...</p>;
  if (state === 'ok') return <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> 送信成功！</p>;
  return <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} /> 送信失敗。URLや設定を確認してください。</p>;
}
