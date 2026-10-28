import { useState, type FormEvent } from 'react';
import { FirebaseError } from 'firebase/app';
import { Eye, EyeOff, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/auth';
import { useOrganization } from '../../contexts/organization';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../utils/password';

function getPasswordChangeError(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/requires-recent-login') {
      return '安全のため再ログインが必要です。ログアウトして、一時パスワードで再度ログインしてください。';
    }
    if (error.code === 'auth/weak-password') {
      return 'より推測されにくいパスワードを指定してください。';
    }
  }
  return 'パスワードを変更できませんでした。通信状態を確認して、もう一度お試しください。';
}

export default function PasswordChangePage() {
  const { signOut } = useAuth();
  const { completePasswordChange } = useOrganization();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [logoutError, setLogoutError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await completePasswordChange(password);
    } catch (changeError) {
      setError(getPasswordChangeError(changeError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await signOut();
    } catch {
      setLogoutError('ログアウトできませんでした。通信状態を確認してください。');
    }
  };

  return (
    <main className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-green-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
            <ShieldCheck className="text-green-700" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">パスワードの変更</h1>
            <p className="text-sm text-gray-500">初回ログイン時に必要です</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-4 mb-5">
          一時パスワードから、ご本人だけが分かるパスワードへ変更してください。
          変更が完了するまで通常画面は利用できません。
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              新しいパスワード
            </label>
            <div className="relative">
              <input
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                disabled={submitting}
                className="w-full border rounded-lg px-3 py-2 pr-10 disabled:bg-gray-100"
                placeholder={`${MIN_PASSWORD_LENGTH}文字以上`}
              />
              <button
                type="button"
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                onClick={() => setShowPassword((current) => !current)}
                disabled={submitting}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {MIN_PASSWORD_LENGTH}文字以上（文字種の制限はありません）
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              新しいパスワード（確認）
            </label>
            <input
              autoComplete="new-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setError('');
              }}
              disabled={submitting}
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleLogout}
          disabled={submitting}
          className="w-full mt-3 py-2 text-sm text-gray-600 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <LogOut size={16} />
          ログアウト
        </button>
        {logoutError && <p role="alert" className="text-xs text-red-600 text-center">{logoutError}</p>}
      </section>
    </main>
  );
}
