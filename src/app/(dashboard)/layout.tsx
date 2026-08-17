import { requireAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TopBar } from "@/components/layout/top-bar";
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
        topBar={<TopBar userName={user.name} userAvatar={user.avatarUrl} />}
      >
        {children}
      </DashboardShell>
      {modal}
    </div>
  );
}
