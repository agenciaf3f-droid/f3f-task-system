import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarUpload } from "./avatar-upload";
import { ProfileForm, PasswordForm } from "../configuracoes/settings-forms";

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  supervisor: "Supervisor",
  member: "Membro",
};

export default async function MinhaContaPage() {
  const user = await requireAuth();

  const [dbUser, company] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, email: true, role: true, avatarUrl: true },
    }),
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    }),
  ]);

  if (!dbUser) return null;

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Minha conta</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      {/* Avatar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <h2 className="text-sm font-bold text-neutral-800">Foto de perfil</h2>
        <AvatarUpload currentAvatar={dbUser.avatarUrl ?? null} userName={dbUser.name} />
      </div>

      {/* Editable profile */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <h2 className="text-sm font-bold text-neutral-800">Informações</h2>
        <ProfileForm name={dbUser.name} email={dbUser.email} />
      </div>

      {/* Password */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <h2 className="text-sm font-bold text-neutral-800">Alterar senha</h2>
        <PasswordForm />
      </div>

      {/* Account info */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
        <h2 className="text-sm font-bold text-neutral-800">Conta</h2>
        <div className="flex flex-col gap-2 text-sm text-neutral-600">
          <div className="flex justify-between">
            <span className="text-neutral-400">Cargo</span>
            <span className="font-medium">{roleLabel[dbUser.role] ?? dbUser.role}</span>
          </div>
          {company && (
            <div className="flex justify-between">
              <span className="text-neutral-400">Empresa</span>
              <span className="font-medium">{company.name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
