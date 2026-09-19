import { NavLink, useLocation } from "react-router-dom";
import { Calendar, Users, MessageSquare, Shuffle, MoreHorizontal } from "lucide-react";

const navItems = [
  { to: "/",        label: "スケジュール", icon: Calendar      },
  { to: "/doubles", label: "組合せ",       icon: Shuffle       },
  { to: "/members", label: "参加者",       icon: Users         },
  { to: "/board",   label: "掲示板",       icon: MessageSquare },
  { to: "/more",    label: "その他",       icon: MoreHorizontal },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] md:hidden z-50">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => {
            const groupedRouteActive = to === "/more"
              && ["/expense", "/report", "/settings"].some((route) => pathname.startsWith(route));
            return (
            `flex min-w-0 min-h-16 flex-col items-center justify-center py-2 text-[11px] font-medium gap-1 transition-colors ${
              isActive || groupedRouteActive ? "text-green-600" : "text-gray-500 hover:text-green-600"
            }`
            );
          }}
        >
          <Icon size={21} />
          <span className="whitespace-nowrap">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
