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
          className="fixed left-3 top-3 z-40 w-10 h-10 flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
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
