# Feature: Recorrência de Tarefas

## O quê
Tasks podem repetir automaticamente em frequências configuráveis. Ao marcar como `done`, a próxima ocorrência é criada. Um cron diário também garante que nada seja perdido.

## Configuração (UI)
`RecurrencePicker` em `/components/tasks/recurrence-picker.tsx`.
Serializa como JSON no campo `recurrenceRule` (coluna `Json?` no Prisma).

## Estrutura da regra (RFC 5545 simplificado)
```ts
type RecurrenceRule = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;          // repetir a cada N unidades
  byWeekday?: number[];      // 0=Dom ... 6=Sáb (só freq=weekly)
  monthDay?: number;         // 1-31 (só freq=monthly)
}
```

## Como funciona

### Trigger 1 — Ao concluir tarefa
`updateTaskStatusAction` (em `tarefas/actions.ts`): quando `newStatus === "done"` e task tem `recurrenceRule`:
1. Chama `parseRecurrenceRuleFromDb(task.recurrenceRule)`
2. Chama `computeNextOccurrence(rule, task.dueDate ?? hoje)`
3. Cria nova task com `recurrenceParentId = task.id` e `dueDate = nextDue`

### Trigger 2 — Cron diário (safety net)
Endpoint: `GET /api/cron/recurrence`
Schedule: `0 3 * * *` (3h UTC, configurado em `vercel.ts`)
Proteção: `Authorization: Bearer $CRON_SECRET`

Lógica: busca tasks onde `recurrenceRule IS NOT NULL`, `recurrenceParentId IS NULL`, e nenhuma ocorrência futura existe → cria a próxima.

## Relação entre tasks
```
Task raiz (recurrenceParentId = null, recurrenceRule = {...})
  └─ Task ocorrência 1 (recurrenceParentId = raiz.id, dueDate = D+1)
  └─ Task ocorrência 2 (recurrenceParentId = raiz.id, dueDate = D+2)
```

## Utilitários (`src/lib/recurrence.ts`)
- `computeNextOccurrence(rule, fromDate)` — calcula próxima data
- `parseRecurrenceRuleFromDb(raw)` — valida e tipifica o JSON do DB

## Env var necessária
`CRON_SECRET` — deve ser adicionado no Vercel Dashboard antes do deploy.
Vercel envia automaticamente `Authorization: Bearer <secret>` nas chamadas de cron.
