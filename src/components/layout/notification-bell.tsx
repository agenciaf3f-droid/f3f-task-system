"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/notificacoes"
      className="relative flex items-center justify-center w-7 h-7 text-neutral-400 hover:text-white transition-colors"
      title="Notificações"
    >
      <Bell className="w-4 h-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
