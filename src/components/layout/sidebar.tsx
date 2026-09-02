"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
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
  Send,
  Gauge,
  PanelLeftClose,
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
  { label: "NPS",            href: "/nps",           icon: Gauge,      roles: ["admin", "manager"] },
  { label: "Disparos",       href: "/disparos",      icon: Send,       roles: ["admin", "manager"] },
  { label: "Histórico",      href: "/historico",     icon: History,    roles: ["admin", "manager"] },
];

interface SidebarProps {
  userName: string;
  userRole: UserRole;
  userEmail: string;
  userAvatar?: string | null;
  collapsed: boolean;
  onCollapse: () => void;
}

const NavLink = memo(function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
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
});

function filterItems(items: NavItem[], userRole: UserRole) {
  return items.filter((item) => !item.roles || item.roles.includes(userRole));
}

export function Sidebar({ userName, userRole, userEmail, userAvatar, collapsed, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const mainNav = useMemo(() => filterItems(MAIN_NAV, userRole), [userRole]);
  const manageNav = useMemo(() => filterItems(MANAGE_NAV, userRole), [userRole]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const initials = userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-out",
      collapsed ? "-translate-x-full" : "translate-x-0",
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border shrink-0">
        <Image src="/logo.png" alt="F3F" width={40} height={40} priority className="w-9 h-9 object-contain shrink-0" />
        <div className="flex-1">
          <span className="font-extrabold text-sm tracking-tight text-sidebar-foreground">F3F Tasks</span>
          <p className="text-[10px] text-sidebar-foreground/40 leading-none mt-0.5 font-medium">Workspace</p>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title="Recolher barra lateral"
          aria-label="Recolher barra lateral"
          className="w-8 h-8 -mr-2 flex items-center justify-center rounded-md text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto flex flex-col gap-6">
        {/* Main */}
        <div className="flex flex-col gap-0.5">
          {mainNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
        </div>

        {/* Manage */}
        {manageNav.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest px-3 mb-1">Gestão</p>
            {manageNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
          </div>
        )}

        {/* Settings */}
        <div className="flex flex-col gap-0.5">
          <NavLink item={{ label: "Configurações", href: "/minha-conta", icon: Settings }} pathname={pathname} />
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
