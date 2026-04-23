import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

// Async server component — fetches unread count without blocking layout
async function TopBarLoader({ userName, userId }: { userName: string; userId: string }) {
  const unreadCount = await getUnreadCount(userId);
  return <TopBar userName={userName} unreadCount={unreadCount} />;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <Sidebar
        userName={user.name}
        userRole={user.role}
        userEmail={user.email}
        userAvatar={user.avatarUrl}
      />
      <div className="pl-64 flex flex-col min-h-screen">
        <Suspense fallback={<TopBar userName={user.name} unreadCount={0} />}>
          <TopBarLoader userName={user.name} userId={user.userId} />
        </Suspense>
        <main className="flex-1">
          <div className="max-w-screen-xl mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
