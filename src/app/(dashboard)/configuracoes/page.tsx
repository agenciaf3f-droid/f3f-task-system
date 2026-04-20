import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm, PasswordForm, CompanyForm, WebhookForm } from "./settings-forms";

export default async function ConfiguracoesPage() {
  const user = await requireAuth();

  const [dbUser, company, webhook] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true, email: true },
    }),
    prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    }),
    user.role === "admin"
      ? prisma.webhookConfig.findUnique({ where: { companyId: user.companyId } })
      : null,
  ]);

  if (!dbUser || !company) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Configurações</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Gerencie seu perfil e preferências</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Profile */}
        <section className="bg-white border border-neutral-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-5">Meu perfil</h2>
          <ProfileForm name={dbUser.name} email={dbUser.email} />
        </section>

        {/* Password */}
        <section className="bg-white border border-neutral-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-5">Alterar senha</h2>
          <PasswordForm />
        </section>

        {/* Company + Webhook — admin only */}
        {user.role === "admin" && (
          <>
            <section className="bg-white border border-neutral-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">Empresa</h2>
              <p className="text-xs text-neutral-400 mb-5">Visível apenas para administradores</p>
              <CompanyForm companyName={company.name} />
            </section>
            <section className="bg-white border border-neutral-200 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">Webhook (WhatsApp / Integrações)</h2>
              <p className="text-xs text-neutral-400 mb-5">
                Configure uma URL para receber eventos do sistema em tempo real.
              </p>
              <WebhookForm
                webhookUrl={webhook?.url}
                webhookSecret={webhook?.secret ?? undefined}
                webhookActive={webhook?.isActive ?? true}
              />
            </section>
          </>
        )}

        {/* Account info */}
        <section className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">Informações da conta</h2>
          <div className="flex flex-col gap-2 text-sm text-neutral-600">
            <div className="flex justify-between">
              <span className="text-neutral-400">Papel</span>
              <span className="font-medium capitalize">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Empresa</span>
              <span className="font-medium">{company.name}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
