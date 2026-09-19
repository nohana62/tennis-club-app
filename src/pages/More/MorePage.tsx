import { CloudRain, DollarSign, FileText, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const items = [
  {
    to: '/more/rain-ranking',
    title: '雨男・雨女ランキング',
    description: '雨天中止になった予定の参加者を期間別に集計',
    icon: CloudRain,
    color: 'bg-sky-100 text-sky-700',
  },
  {
    to: '/expense',
    title: '経費計算',
    description: '部活動の経費を登録・集計',
    icon: DollarSign,
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    to: '/report',
    title: '報告書作成',
    description: '活動内容をPDF・Excelで出力',
    icon: FileText,
    color: 'bg-amber-100 text-amber-700',
  },
  {
    to: '/settings',
    title: '設定',
    description: '部員・通知・アプリ情報を管理',
    icon: Settings,
    color: 'bg-gray-100 text-gray-700',
  },
];

export default function MorePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800">その他</h1>
        <p className="text-xs text-gray-500 mt-1">利用する機能を選択してください。</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(({ to, title, description, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 hover:border-green-300 hover:shadow-sm transition"
          >
            <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={24} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-800">{title}</span>
              <span className="block text-xs text-gray-500 mt-1">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
