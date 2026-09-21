import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/auth';

function getLoginErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  if (code === 'auth/invalid-credential') {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }
  if (code === 'auth/too-many-requests') {
    return '試行回数が多すぎます。しばらく待ってからお試しください。';
  }
  if (code === 'auth/network-request-failed') {
    return '通信できませんでした。通信状態を確認してください。';
  }
  return 'ログインできませんでした。時間をおいてもう一度お試しください。';
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (loginError) {
      setError(getLoginErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-4xl" aria-hidden="true">🎾</div>
          <h1 className="mt-2 text-xl font-bold text-gray-900">テニス部管理アプリ</h1>
          <p className="mt-1 text-sm text-gray-600">登録されたアカウントでログインしてください</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700">
            メールアドレス
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            パスワード
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </section>
    </main>
  );
}
