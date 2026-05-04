# 2026-05-04 — Sprint 4: Dependências entre tarefas e Kanban

## O quê
- Dependências entre tarefas com detecção de ciclos e badge "Aguardando"
- View Kanban no projeto com drag-and-drop por status

## Por quê
Paridade com Asana: dependências são críticas para projetos com sequência de trabalho. Kanban é a view mais usada em ferramentas de gestão.

## Como

**Dependências**
- `prisma/schema.prisma` — model `TaskDependency { taskId, blocksTaskId }` + relations `blockedBy` / `blocking` em Task
- `prisma/migrations/20260504010000_add_task_dependencies/` — aplicado via Supabase MCP
- `npx prisma generate` — client regenerado
- `tarefas/dependency-actions.ts` (novo) — `addDependencyAction` (BFS cycle detection antes de inserir) + `removeDependencyAction`; edge: `taskId → blocksTaskId` = "taskId bloqueia blocksTaskId"
- `tarefas/[id]/dependencies-section.tsx` (novo) — lista de bloqueadores com status visual (verde=done, âmbar=pendente), badge "Aguardando" se há bloqueadores em aberto, picker de tarefas do mesmo projeto
- `@modal/(.)tarefas/[id]/page.tsx` — inclui `blockedBy` na query + busca `allTasks` do projeto, renderiza `DependenciesSection`

**Kanban View**
- `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- `projetos/[id]/kanban-view.tsx` (novo) — 5 colunas (todo, in_progress, review, blocked, done), drag via `useDraggable`/`useDroppable`, optimistic status update via `updateTaskStatusAction`, revert on error
- `projetos/[id]/page.tsx` — novo `?view=list|kanban` param; toggle visual (LayoutList/Kanban icons); sort buttons só visíveis em list view; `KanbanView` renderizado no lugar de `TaskList` quando `view=kanban`

## Verificação
1. Dependências: abrir tarefa no modal → seção "Dependências" → adicionar bloqueador → badge "Aguardando" aparece → tentar adicionar ciclo → erro "criaria um ciclo"
2. Kanban: `/projetos/[id]?view=kanban` → board com 5 colunas → arrastar card → status muda → recarregar confirma persistência
3. Toggle: clicar LayoutList/Kanban alterna view preservando sortBy

## Nota de IDE
O TS server do VS Code mostra `never` em `task.blockedBy` e `task.assignees` — stale cache do Prisma client. `npx tsc --noEmit` confirma zero erros. Fix: `Ctrl+Shift+P` → "TypeScript: Restart TS Server".
