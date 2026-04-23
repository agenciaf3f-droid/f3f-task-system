import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

// Async server component — fetches unread count without blocking layout
async function TopBarLoader({ userName, userId, userAvatar }: { userName: string; userId: string; userAvatar?: string | null }) {
  const [unreadCount, upcomingTasks] = await Promise.all([
    getUnreadCount(userId),
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: { notIn: ["done", "cancelled"] },
        deletedAt: null,
        dueDate: { lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      select: {
        id: true, title: true, dueDate: true, status: true,
        project: { select: { name: true } },
      },
    }),
  ]);
  return <TopBar userName={userName} unreadCount={unreadCount} userAvatar={userAvatar} upcomingTasks={upcomingTasks} />;
}

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal?: React.ReactNode;
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
        <Suspense fallback={<TopBar userName={user.name} unreadCount={0} userAvatar={user.avatarUrl} upcomingTasks={[]} />}>
          <TopBarLoader userName={user.name} userId={user.userId} userAvatar={user.avatarUrl} />
        </Suspense>
        <main className="flex-1">
          <div className="max-w-screen-xl mx-auto px-8 py-8">{children}</div>
        </main>
      </div>
      {modal}
    </div>
  );
}
