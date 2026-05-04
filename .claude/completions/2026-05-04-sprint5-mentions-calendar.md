# 2026-05-04 — Sprint 5: @mentions em comentários e Calendar view

## O quê
- @mentions em comentários com autocomplete e notificação ao usuário mencionado
- View calendário no projeto mostrando tarefas por dueDate em grade mensal navegável

## Por quê
Paridade com Asana: mentions são o principal mecanismo de comunicação contextual; calendar view é essencial para gerenciar prazos visualmente.

## Como

**@mentions**
- `tarefas/actions.ts` (addCommentAction) — após criar o comentário, aplica regex `/@\[([^\]]+)\]\(uuid\)/gi` no content; para cada mention única, verifica se o userId pertence à mesma company e cria `Notification(type: "mention", title, body, resourceType: "task", resourceId)`
- `tarefas/[id]/comments-section.tsx` — reescrito com `MentionTextarea`: detecta `@palavra` no texto via regex na última `@` antes do cursor; mostra dropdown filtrado de usuários; ao selecionar, insere `@[Name](uuid)` no texto; renderContent() parseia `@[Name](uuid)` → `<span class="text-blue-600">@Name</span>` na exibição
- `@modal/(.)tarefas/[id]/page.tsx` — passa `users={allUsers}` ao CommentsSection (já disponível na query)

**Calendar view**
- `projetos/[id]/calendar-view.tsx` (novo) — grade 7 colunas sem deps externas; usa date-fns para calcular dias do mês; tarefas agrupadas por `format(dueDate, "yyyy-MM-dd")`; navegação por mês; cores: done=verde, overdue=vermelho, normal=neutro; seção "Sem prazo" abaixo da grade
- `projetos/[id]/page.tsx` — 3° botão de toggle (CalendarDays icon); `?view=calendar` renderiza `CalendarView`; container sem border-radius wrapper no kanban/calendar (layout diferente do list)

## Verificação
1. Mentions: comentar com `@[Nome de usuário]` → notificação aparece no DB: `SELECT * FROM notifications WHERE type = 'mention' LIMIT 5;`
2. Autocomplete: digitar `@Ra` → dropdown mostra usuários filtrando por "Ra" → selecionar → texto substitui com formato correto
3. Calendar: `/projetos/[id]?view=calendar` → grade do mês atual → tarefas vencidas aparecem em vermelho → navegar mês → tasks sem prazo aparecem abaixo
