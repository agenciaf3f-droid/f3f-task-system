"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  History,
  FolderKanban,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const MAIN_NAV: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Projetos",   href: "/projetos",   icon: FolderKanban    },
  { label: "Templates",  href: "/templates",  icon: FileText        },
];

const MANAGE_NAV: NavItem[] = [
  { label: "Setores",        href: "/setores",       icon: Building2  },
  { label: "Equipe",         href: "/equipe",        icon: Users,      roles: ["admin", "manager"] },
  { label: "Relatórios",     href: "/relatorios",    icon: BarChart3,  roles: ["admin", "manager"] },
  { label: "Histórico",      href: "/historico",     icon: History,    roles: ["admin", "manager"] },
];

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  userEmail: string;
  userAvatar?: string | null;
}

export function Sidebar({ userName, userRole, userEmail, userAvatar }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function filterItems(items: NavItem[]) {
    return items.filter((item) => !item.roles || item.roles.includes(userRole));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
          isActive
            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
            : "text-slate-400 hover:text-white hover:bg-white/8",
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#05091c] text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/6 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/40">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <span className="font-extrabold text-sm tracking-tight text-white">F3F Tasks</span>
          <p className="text-[10px] text-slate-500 leading-none mt-0.5 font-medium">Workspace</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col gap-6">
        {/* Main */}
        <div className="flex flex-col gap-0.5">
          {filterItems(MAIN_NAV).map((item) => <NavLink key={item.href} item={item} />)}
        </div>

        {/* Manage */}
        {filterItems(MANAGE_NAV).length > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-1">Gestão</p>
            {filterItems(MANAGE_NAV).map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        )}

        {/* Settings */}
        <div className="flex flex-col gap-0.5">
          <NavLink item={{ label: "Configurações", href: "/configuracoes", icon: Settings }} />
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/6 p-3 shrink-0">
        <Link href="/minha-conta" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover shrink-0 shadow shadow-blue-500/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow shadow-blue-500/30">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </aside>
  );
}
