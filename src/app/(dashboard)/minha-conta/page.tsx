import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvatarUpload } from "./avatar-upload";
import Link from "next/link";
import { KeyRound } from "lucide-react";

export default async function MinhaContaPage() {
  const user = await requireAuth();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { name: true, email: true, role: true, avatarUrl: true, createdAt: true },
  });

  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    manager: "Gestor",
    supervisor: "Supervisor",
    member: "Membro",
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Minha conta</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      {/* Avatar */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <h2 className="text-sm font-bold text-neutral-800">Foto de perfil</h2>
        <AvatarUpload currentAvatar={dbUser?.avatarUrl ?? null} userName={dbUser?.name ?? ""} />
      </div>

      {/* Info */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h2 className="text-sm font-bold text-neutral-800">Informações</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Nome</p>
            <p className="font-medium text-neutral-900">{dbUser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">E-mail</p>
            <p className="font-medium text-neutral-900">{dbUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">Cargo</p>
            <p className="font-medium text-neutral-900">{roleLabel[dbUser?.role ?? ""] ?? dbUser?.role}</p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-neutral-800">Senha</p>
          <p className="text-xs text-neutral-500 mt-0.5">Altere sua senha de acesso</p>
        </div>
        <Link
          href="/minha-conta/senha"
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-neutral-900 text-white rounded-xl hover:bg-neutral-700 transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          Alterar senha
        </Link>
      </div>
    </div>
  );
}
