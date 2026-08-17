import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TopBar } from "@/components/layout/top-bar";

// Async server component — carrega os prazos próximos sem bloquear o layout
async function TopBarLoader({ userName, userId, userAvatar }: { userName: string; userId: string; userAvatar?: string | null }) {
  const upcomingTasks = await prisma.task.findMany({
    where: {
      OR: [
        { assigneeId: userId },
        { assignees: { some: { userId } } },
      ],
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
  });
  return <TopBar userName={userName} userAvatar={userAvatar} upcomingTasks={upcomingTasks} />;
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
    <div className="min-h-screen bg-neutral-50">
      <DashboardShell
        user={{ name: user.name, role: user.role, email: user.email, avatarUrl: user.avatarUrl }}
        topBar={
          <Suspense fallback={<TopBar userName={user.name} userAvatar={user.avatarUrl} upcomingTasks={[]} />}>
            <TopBarLoader userName={user.name} userId={user.userId} userAvatar={user.avatarUrl} />
          </Suspense>
        }
      >
        {children}
      </DashboardShell>
      {modal}
    </div>
  );
}
