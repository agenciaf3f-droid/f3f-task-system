# Feature: Modais com Intercepting Routes

## O quê
Tarefas abrem em modal ao navegar via soft-nav (links internos). Navegar direto pela URL abre a página completa.

## Estrutura de arquivos
```
src/app/(dashboard)/
  @modal/
    (.)tarefas/
      [id]/
        page.tsx        # conteúdo do modal (server component)
        modal-client.tsx # wrapper cliente (overlay, close, Esc)
        layout.tsx      # slot @modal
      nova/
        page.tsx
        ...
  tarefas/
    [id]/
      page.tsx          # página completa (fallback sem modal)
```

## Como fechar o modal
`ModalClient` sempre chama `router.back()`. Não há verificação de `history.length`.

**Por quê:** `ModalClient` só é renderizado via soft-nav (intercepting route).
Navegar direto pela URL renderiza `tarefas/[id]/page.tsx` sem o `@modal` slot — logo `router.back()` é sempre seguro.

## Tecla Esc
`useEffect` com `keydown` → `onClose()` → `router.back()`

## Link com returnTo
Ao abrir edição a partir do modal:
```
href="/tarefas/[id]/editar?returnTo=/projetos/[projectId]"
```
Após salvar, `updateTaskAction` redireciona para `returnTo` preservando o contexto.

## Regra: sempre LinkButton, nunca `<a href>`
`<a href>` força full-page reload e quebra o intercepting route.
Use `<LinkButton>` ou `<Link>` do Next.js para navegação interna.
