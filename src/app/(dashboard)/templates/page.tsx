import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FileText, Plus, Hash, Pencil, LockKeyhole, UserRound } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { ToggleTemplateButton } from "./toggle-template-button";
import { DeleteTemplateButton } from "./delete-template-button";
import { ActivateTemplateDialog } from "./activate-template-dialog";
import { templateVisibilityFilter } from "@/lib/template-access";

export default async function TemplatesPage() {
  const user = await requireAuth();

  const canManageShared = user.role === "admin" || user.role === "manager";
  const canViewAllPersonal = user.role === "admin";
  const [templates, users] = await Promise.all([
    prisma.template.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      ...templateVisibilityFilter(user),
    },
    orderBy: [{ isActive: "desc" }, { position: "asc" }, { name: "asc" }],
    include: {
      sector: { select: { name: true, color: true } },
      targetSectors: { include: { sector: { select: { name: true, color: true } } } },
      targetUsers: { include: { user: { select: { id: true, name: true } } } },
      createdBy: { select: { name: true } },
      _count: { select: { templateTasks: true } },
    },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const active = templates.filter((t) => t.isActive);
  const inactive = templates.filter((t) => !t.isActive);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Templates</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Processos padronizados que geram tarefas com 1 clique
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/templates/personalizado/novo" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Criar template personalizado
          </LinkButton>
          {canManageShared && (
            <LinkButton href="/templates/novo">
              <Plus className="w-4 h-4 mr-2" />
              Novo template
            </LinkButton>
          )}
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600">Nenhum template ainda</p>
          <p className="text-xs text-neutral-400 mt-1 mb-5">
            Templates padronizam seus processos e economizam tempo
          </p>
          {canManageShared && (
            <LinkButton href="/templates/novo" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro template
            </LinkButton>
          )}
        </div>
      ) : (
        <>
          {/* Active templates */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((template) => (
              <div
                key={template.id}
                className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-sm leading-tight">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  {(template.isPersonal ? template.createdById === user.userId || canViewAllPersonal : canManageShared) && (
                    <LinkButton
                      href={`/templates/${template.id}/editar`}
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 px-2 text-xs"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Editar
                    </LinkButton>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {template._count.templateTasks} tarefa{template._count.templateTasks !== 1 ? "s" : ""}
                  </span>
                  {template.sector && (
                    <span className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: template.sector.color ?? "#d1d5db" }}
                      />
                      {template.sector.name}
                    </span>
                  )}
                  {template.isPersonal && template.targetSectors.map(({ sector }) => (
                    <span key={sector.name} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sector.color ?? "#d1d5db" }} />
                      {sector.name}
                    </span>
                  ))}
                  {template.isPersonal && template.targetUsers.map(({ user: targetUser }) => (
                    <span key={targetUser.id} className="flex items-center gap-1">
                      <UserRound className="w-3 h-3" />
                      {targetUser.name}
                    </span>
                  ))}
                  {template.category && (
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                      {template.category}
                    </span>
                  )}
                  {template.isPersonal && (
                    <span className="flex items-center gap-1 bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full font-medium">
                      <LockKeyhole className="w-3 h-3" />
                      Personalizado
                    </span>
                  )}
                  {template.isPersonal && canViewAllPersonal && template.createdById !== user.userId && (
                    <span className="flex items-center gap-1 text-neutral-400">
                      <UserRound className="w-3 h-3" />
                      {template.createdBy.name}
                    </span>
                  )}
                  {template.useCount > 0 && (
                    <span className="text-neutral-400">usado {template.useCount}×</span>
                  )}
                </div>

                {/* Footer actions */}
                <div className="flex flex-col gap-2 pt-3 mt-auto border-t border-neutral-100">
                  <div className="w-full min-w-0">
                    <ActivateTemplateDialog
                      templateId={template.id}
                      templateName={template.name}
                      taskCount={template._count.templateTasks}
                      users={users}
                    />
                  </div>
                  {(template.isPersonal ? template.createdById === user.userId || canViewAllPersonal : canManageShared) && (
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 min-w-0">
                      <ToggleTemplateButton templateId={template.id} isActive={template.isActive} />
                      <DeleteTemplateButton templateId={template.id} templateName={template.name} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Inactive templates */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wide">
                Desativados ({inactive.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inactive.map((template) => (
                  <div
                    key={template.id}
                    className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex items-center justify-between gap-3 opacity-70"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-600 truncate">{template.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {template._count.templateTasks} tarefa{template._count.templateTasks !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {(template.isPersonal ? template.createdById === user.userId || canViewAllPersonal : canManageShared) && (
                      <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                        <LinkButton
                          href={`/templates/${template.id}/editar`}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Editar
                        </LinkButton>
                        <ToggleTemplateButton templateId={template.id} isActive={template.isActive} />
                        <DeleteTemplateButton templateId={template.id} templateName={template.name} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
