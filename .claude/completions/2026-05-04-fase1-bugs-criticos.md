# 2026-05-04 — Fase 1: Correção dos 4 bugs críticos

## O quê
Corrigidos 4 bugs que quebravam fluxos básicos: recorrência inerte, edição perde contexto, modal não fecha confiável, e edição abre página full em vez do modal.

## Por quê
Bugs reportados pelo usuário. Todos relacionados ao fluxo de tarefas — a área de maior uso do sistema.

## Como

**1. Recorrência (completamente inerte → funcional)**
- `src/app/(dashboard)/tarefas/actions.ts` — `taskSchema` não incluía `recurrenceRule`; adicionado parsing + save em `createTaskAction` e `updateTaskAction`. Em `updateTaskStatusAction`: ao marcar `done`, cria próxima ocorrência via `computeNextOccurrence`.
- `src/lib/recurrence.ts` (novo) — `computeNextOccurrence(rule, fromDate)` + `parseRecurrenceRuleFromDb(raw)`.
- `src/app/api/cron/recurrence/route.ts` (novo) — safety net diário protegido por `CRON_SECRET`.
- `vercel.ts` (novo) — cron `0 3 * * *`.

**2. Edição perde contexto → returnTo pattern**
- `src/app/(dashboard)/@modal/(.)tarefas/[id]/page.tsx:76` — botão Editar passa `?returnTo=/projetos/[id]`.
- `src/app/(dashboard)/tarefas/[id]/editar/page.tsx` + `form.tsx` — lê e propaga `returnTo` como hidden input.
- `src/app/(dashboard)/tarefas/actions.ts` (updateTaskAction) — redireciona para `returnTo` se presente.

**3. Modal não fecha confiável → router.back() incondicional**
- `src/app/(dashboard)/@modal/(.)tarefas/[id]/modal-client.tsx:18` — removida verificação `window.history.length > 1`; `onClose` sempre chama `router.back()`. `ModalClient` só monta via soft-nav, então histórico é garantido.

**4. Editar abre full-page (sem fix de rota interceptada)**
- Mantido comportamento atual (full-page) mas com `returnTo` garantindo retorno ao contexto correto pós-save.

## Verificação
1. Criar task com recorrência diária → marcar como `done` → nova task aparece com `recurrenceParentId` preenchido
2. Abrir task via modal em `/projetos/X` → clicar Editar → salvar → retorna a `/projetos/X`
3. Abrir modal → pressionar Esc → fecha sem flicker ou erro
4. Cron: `curl localhost:3000/api/cron/recurrence -H "Authorization: Bearer $CRON_SECRET"` → retorna `{ ok: true, created: N }`
