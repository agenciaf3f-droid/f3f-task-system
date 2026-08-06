"use client";

import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: React.ReactNode;
  topBar: React.ReactNode;
  user: {
    name: string;
    role: UserRole;
    email: string;
    avatarUrl?: string | null;
  };
}

const SIDEBAR_STATE_KEY = "f3f-tasks-sidebar-collapsed";

export function DashboardShell({ children, topBar, user }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STATE_KEY) === "true");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(SIDEBAR_STATE_KEY, String(collapsed));
  }, [collapsed, ready]);

  return (
    <>
      <Sidebar
        userName={user.name}
        userRole={user.role}
        userEmail={user.email}
        userAvatar={user.avatarUrl}
        collapsed={collapsed}
        onCollapse={() => setCollapsed(true)}
      />

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Abrir barra lateral"
          aria-label="Abrir barra lateral"
          className="fixed left-0 top-1/2 z-[60] flex h-14 w-9 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-neutral-200 bg-white text-neutral-500 shadow-md hover:w-10 hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      <div className={cn(
        "flex flex-col min-h-screen transition-[padding] duration-300 ease-out",
        collapsed ? "pl-0" : "pl-64",
      )}>
        {topBar}
        <main className="flex-1">
          <div className={cn("mx-auto px-8 py-8", collapsed ? "max-w-none" : "max-w-screen-xl")}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
