import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import BottomNav from './BottomNav';
import { IS_DEMO, useAuth } from '../contexts/auth';
import { useOrganization } from '../contexts/organization';
import type { OrganizationId } from '../types';

export default function Layout() {
  const { signOut } = useAuth();
  const {
    organization,
    userProfile,
    availableOrganizations,
    selectOrganization,
  } = useOrganization();
  const organizationSelector = availableOrganizations.length > 1 ? (
    <select
      aria-label="利用する団体"
      value={organization?.id ?? ''}
      onChange={(event) => selectOrganization(event.target.value as OrganizationId)}
      className="max-w-48 rounded border border-current bg-transparent px-2 py-1 text-sm"
    >
      {availableOrganizations.map(({ organization: option }) => (
        <option className="text-gray-900" key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  ) : (
    <span className="font-medium">{organization?.name}</span>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />
      <main className="flex-1 flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 overflow-auto">
        {/* モバイル上部ヘッダー */}
        <header className="flex items-center gap-2 px-4 py-3 bg-green-700 text-white md:hidden">
          <span className="text-xl">🎾</span>
          {organizationSelector}
          {!IS_DEMO && (
            <button className="ml-auto text-sm underline" onClick={signOut} type="button">
              ログアウト
            </button>
          )}
        </header>
        {!IS_DEMO && (
          <div className="hidden md:flex items-center justify-end gap-3 border-b bg-white px-6 py-2 text-sm text-gray-600">
            {organizationSelector}
            <span>{userProfile?.displayName}</span>
            <button className="font-medium text-green-700 underline" onClick={signOut} type="button">
              ログアウト
            </button>
          </div>
        )}
        {IS_DEMO && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
            <span className="text-base">🧪</span>
            <span>
              <strong>デモモード</strong>で動作中 — サンプルデータを使用しています。
              データはページリロードでリセットされます。
              本番利用には Firebase の設定が必要です。
            </span>
          </div>
        )}
        <div key={organization?.id ?? 'unresolved'} className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
