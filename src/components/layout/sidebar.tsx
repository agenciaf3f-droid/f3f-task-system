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
  CalendarDays,
  Briefcase,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
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
  { label: "Clientes",   href: "/clientes",   icon: Briefcase       },
  { label: "Calendário", href: "/calendario", icon: CalendarDays    },
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
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
        <img src="/logo.png" alt="F3F" className="w-9 h-9 object-contain shrink-0" />
        <div>
          <span className="font-extrabold text-sm tracking-tight text-sidebar-foreground">F3F Tasks</span>
          <p className="text-[10px] text-sidebar-foreground/40 leading-none mt-0.5 font-medium">Workspace</p>
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
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1">Gestão</p>
            {filterItems(MANAGE_NAV).map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        )}

        {/* Settings */}
        <div className="flex flex-col gap-0.5">
          <NavLink item={{ label: "Configurações", href: "/minha-conta", icon: Settings }} />
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <Link href="/minha-conta" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover shrink-0 shadow shadow-sidebar-primary/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0 shadow shadow-sidebar-primary/30">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{userName}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">{userEmail}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="w-7 h-7 flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors" />
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-7 h-7 flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </Link>
      </div>
    </aside>
  );
}
