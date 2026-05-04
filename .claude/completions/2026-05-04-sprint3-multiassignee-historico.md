# 2026-05-04 — Sprint 3: Multi-assignee e Histórico com filtros

## O quê
- Histórico de ações ganhou filtros (usuário, tipo de ação, recurso, período) e paginação de 50 itens
- Múltiplos responsáveis por tarefa — nova tabela `task_assignees` com backfill dos dados existentes

## Por quê
Paridade com Asana: múltiplos responsáveis é fluxo central. Histórico sem filtro era inutilizável com muitos eventos.

## Como

**Histórico**
- `historico/page.tsx` — reescrito com `searchParams` (userId, action, resource, from, to, page), paginação de 50 items, link "ver tarefa →" para tasks
- `historico/historico-filters.tsx` (novo) — client component com selects de URL-based filtering

**Multi-assignee**
- `prisma/schema.prisma` — novo model `TaskAssignee { taskId, userId, assignedAt, assignedById }` + relations em `Task` e `User`
- `prisma/migrations/20260504000000_add_task_assignees/migration.sql` — criado manualmente (sem conexão local); aplicado via Supabase MCP no projeto `ssjrodoncogeluelurav`; backfill de `tasks.assignee_id` → `task_assignees`
- `npx prisma generate` — client regenerado
- `tarefas/assignee-actions.ts` (novo) — `addTaskAssigneeAction` (upsert, valida companyId) + `removeTaskAssigneeAction`
- `tarefas/[id]/assignees-section.tsx` (novo) — chip list com picker lazy (usuários da empresa), remoção por X, optimistic UI
- `@modal/(.)tarefas/[id]/page.tsx` — inclui `assignees` na query + lista `allUsers`, renderiza `AssigneesSection` substituindo o display de assignee único

## Verificação
1. Histórico: ir em `/historico` → filtrar por usuário → resultado reduz corretamente → limpar filtros → volta ao total
2. Multi-assignee: abrir tarefa no modal → "Adicionar" aparece → selecionar usuário → chip aparece → X remove → reload confirma persistência
3. DB: `SELECT * FROM task_assignees LIMIT 10;` deve retornar dados (backfill do migration)
