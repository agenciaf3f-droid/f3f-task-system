# ADR-0002: Intercepting Routes como padrão de modal

**Data:** 2026-05-04
**Status:** Aceito

## Contexto
Precisávamos exibir detalhes de tarefa como modal ao clicar em um item de lista, mantendo a URL navegável e o contexto da página anterior.

## Decisão
Usar Next.js Intercepting Routes (`@modal/(.)tarefas/[id]`) com parallel routes (`@modal` slot).

## Motivo
- URL permanece atualizável — compartilhável, recarregável
- Soft-nav abre modal; hard-nav (refresh/link direto) abre página completa
- Nenhuma biblioteca de modal externa necessária
- Close via `router.back()` restaura estado anterior naturalmente

## Trade-offs aceitos
- Dois arquivos de layout de UI: `@modal/[id]/page.tsx` e `tarefas/[id]/page.tsx` precisam manter paridade de conteúdo
- Complexidade adicional de roteamento vs modal simples em memória
- `router.back()` depende de histórico de navegação (garantido pois `ModalClient` só monta via soft-nav)

## Regras derivadas
- Sempre `<LinkButton>`/`<Link>` para nav interna — nunca `<a href>`
- Close sempre via `router.back()` — nunca `router.push()`
- Edição dentro do modal: passar `?returnTo=` para preservar contexto pós-save
