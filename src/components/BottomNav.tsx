import { NavLink } from "react-router-dom";
import { Calendar, Users, DollarSign, FileText, Settings } from "lucide-react";

const navItems = [
  { to: "/",        label: "スケジュール", icon: Calendar   },
  { to: "/members", label: "参加者",       icon: Users      },
  { to: "/expense", label: "経費",         icon: DollarSign },
  { to: "/report",  label: "報告書",       icon: FileText   },
  { to: "/settings",label: "設定",         icon: Settings   },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-50">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-2 text-xs gap-1 transition-colors ${
              isActive ? "text-green-600" : "text-gray-500 hover:text-green-600"
            }`
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
