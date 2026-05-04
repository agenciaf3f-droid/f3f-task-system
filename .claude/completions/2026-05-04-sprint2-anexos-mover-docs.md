# 2026-05-04 — Sprint 2: Anexos, Mover Tarefas e Documentação

## O quê
- ADRs 0003 (multi-tenant) e 0004 (soft-delete) criados
- Feature 3.5: mover tarefa entre projetos — botão "Mover" no modal com dropdown lazy
- Feature 3.1: anexos com Supabase Storage — upload, download (signed URL 60s), delete

## Por quê
Paridade com Asana: anexos e mover tarefas são fluxos básicos ausentes. ADRs documentam decisões já implícitas no código.

## Como

**Mover tarefas**
- `tarefas/actions.ts` — `fetchProjectsForMoveAction` (lazy, chamado ao abrir dropdown) + `moveTaskToProjectAction` (valida ownership de task e projeto, revalida paths do projeto antigo e novo)
- `tarefas/[id]/move-task-button.tsx` (novo) — dropdown com lista de projetos, mesmo padrão visual do status selector
- `@modal/(.)tarefas/[id]/page.tsx` — botão Mover ao lado de Editar, só para `canEdit`

**Anexos**
- `tarefas/attachment-actions.ts` (novo) — `uploadAttachmentAction` (valida mime + 10MB, faz upload via `supabaseAdmin`, salva path no DB), `deleteAttachmentAction`, `getAttachmentSignedUrlAction` (signed URL 60s)
- `tarefas/[id]/attachments-section.tsx` (novo) — lista com hover reveal de botões, upload via `<input type="file">` oculto, download via signed URL
- `@modal/(.)tarefas/[id]/page.tsx` — inclui `attachments` na query do modal, renderiza `AttachmentsSection`

Storage path: `{companyId}/{taskId}/{timestamp}-{uuid}.{ext}` no bucket `task-attachments`.

## Verificação
1. Mover: abrir task no modal → Mover → selecionar projeto → task some da lista do projeto antigo e aparece no novo
2. Anexos: requer Supabase Storage configurado com bucket `task-attachments` (público ou com service role)
   - Criar bucket no Supabase Dashboard: Storage → New bucket → `task-attachments`
   - Adicionar env vars reais: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Upload arquivo → aparece na lista → download → delete

## Pendente (pré-produção)
- Criar bucket `task-attachments` no Supabase Dashboard
- Configurar env vars reais no `.env.local` e no Vercel Dashboard
