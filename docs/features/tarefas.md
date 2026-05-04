# Feature: Tarefas

## O quê
CRUD completo de tarefas com status, prioridade, prazo, responsável, setor, checklist, comentários e recorrência.

## Rotas
- `/tarefas` — lista geral (filtro por status)
- `/tarefas/nova` — criação (modal interceptado via `@modal/(.)tarefas/nova`)
- `/tarefas/[id]` — detalhe (modal interceptado via `@modal/(.)tarefas/[id]`)
- `/tarefas/[id]/editar` — edição

## Schema (campos principais)
```
Task {
  id, companyId, title, description
  status: todo | in_progress | review | done | cancelled
  priority: low | medium | high | urgent
  progress: Int (0-100)
  assigneeId → User
  sectorId   → Sector
  projectId  → Project
  createdById → User
  dueDate
  recurrenceRule: Json?         # RFC 5545 simplificado
  recurrenceParentId → Task?   # se é ocorrência, aponta pra task raiz
  checklistItems → ChecklistItem[]
  comments → Comment[]
  deletedAt                     # soft-delete
}
```

## Status flow
`todo` → `in_progress` → `review` → `done | cancelled`
Qualquer status pode ir pra `cancelled`. Só admin/manager ou assignee/creator pode mudar.

## Permissões de edição
`canEdit = role === "admin" || role === "manager" || assigneeId === userId || createdById === userId`

## Checklist
- Items ordenados por `position` (asc)
- Progresso da task = `(doneItems / totalItems) * 100`, atualizado automaticamente em `toggleChecklistItem`
- Se sem checklist → `ProgressSlider` manual (0-100)

## Ações (server actions em `tarefas/actions.ts`)
- `createTaskAction` — cria + logActivity + dispatchWebhook
- `updateTaskAction` — atualiza + suporta `returnTo` redirect
- `updateTaskStatusAction` — muda status; se `done` + tem recurrenceRule → cria próxima ocorrência
- `updateTaskAssigneeAction`, `updateTaskProgressAction`
- `deleteTaskAction` — soft-delete

## Padrão `returnTo`
Ao abrir edição a partir de um modal/projeto, a URL carrega `?returnTo=/projetos/[id]`.
O form guarda em hidden input → action redireciona de volta à origem após salvar.
