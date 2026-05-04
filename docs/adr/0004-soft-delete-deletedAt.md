# ADR-0004: Soft-delete via deletedAt

**Data:** 2026-05-04
**Status:** Aceito

## Contexto
Tarefas, projetos, usuários e outros recursos precisam de deleção que preserve histórico e permita auditoria.

## Decisão
Deleção é um `update` que seta `deletedAt = now()`. Todas as queries de leitura incluem `deletedAt: null` no where.

## Por quê
- Preserva histórico no `ActivityLog` (logs referenciam IDs que continuam existindo)
- Permite "desfazer" sem restore de backup
- `comments`, `checklistItems` etc. com `onDelete: Cascade` no schema — deleção física do pai remove filhos automaticamente se necessário

## Regras derivadas
- Todo `findMany` e `findFirst` deve ter `deletedAt: null` (exceto queries de auditoria)
- `deleteTaskAction` = `prisma.task.update({ data: { deletedAt: new Date() } })`
- Não há "lixeira" visível ao usuário ainda — item deletado some da UI permanentemente (mas existe no DB)

## Distinção: arquivar vs deletar
`deletedAt` = removido permanentemente (usuário deletou).
`archivedAt` = fora de vista mas relevante (futuro — ver Fase 3.6).
Não usar `deletedAt` para arquivamento — são estados diferentes com semânticas distintas.
