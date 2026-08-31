import { NavLink } from "react-router-dom";
import { Calendar, Users, DollarSign, FileText, Settings } from "lucide-react";

const navItems = [
  { to: "/",        label: "スケジュール管理", icon: Calendar  },
  { to: "/members", label: "参加者管理",       icon: Users     },
  { to: "/expense", label: "経費計算",         icon: DollarSign },
  { to: "/report",  label: "報告書作成",       icon: FileText  },
  { to: "/settings",label: "通知設定",         icon: Settings  },
];

export default function SideNav() {
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-green-700 text-white">
      <div className="px-4 py-6 border-b border-green-600">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎾</span>
          <div>
            <p className="font-bold text-lg leading-tight">テニス部</p>
            <p className="text-green-200 text-xs">管理アプリ</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white text-green-700 font-semibold"
                  : "text-green-100 hover:bg-green-600"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
