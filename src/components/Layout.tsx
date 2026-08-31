import { Outlet } from 'react-router-dom';
import SideNav from './SideNav';
import BottomNav from './BottomNav';

const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />
      <main className="flex-1 flex flex-col pb-16 md:pb-0 overflow-auto">
        {/* モバイル上部ヘッダー */}
        <header className="flex items-center gap-2 px-4 py-3 bg-green-700 text-white md:hidden">
          <span className="text-xl">🎾</span>
          <span className="font-bold">テニス部管理アプリ</span>
        </header>
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
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
