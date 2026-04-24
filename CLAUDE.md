# F3F Task System

Sistema interno de tarefas. Deploy: https://f3f-task-system.vercel.app

## Stack
Next.js 16 (App Router) · Prisma + Postgres (Supabase) · iron-session + bcryptjs · Resend · Tailwind v4 · shadcn/ui · Vercel

## Auth — REGRA CRÍTICA
**NUNCA usar `supabase.auth.*`.** Auth é 100% bcryptjs + iron-session.
- Login: `prisma.user.findUnique` + `compare(senha, passwordHash)` em `src/lib/auth.ts`
- Sessão: cookie iron-session (`SESSION_SECRET`)
- Reset senha: token em `PasswordResetToken` (1h validade) + `sendPasswordResetEmail`
- Convite: senha temporária + hash no banco + `sendInviteEmail`
- Troca senha: bcrypt direto no banco

`supabaseAdmin` (`src/lib/supabase/admin.ts`) existe SÓ para Storage de avatares.

## Email — Resend
Tudo em `src/lib/email.ts`. Funções: `sendInviteEmail`, `sendPasswordResetEmail`, `sendTaskAssignedEmail`, `sendDueReminderEmail`.

Padrão obrigatório dentro de cada função (TypeScript narrowing):
```ts
const config = getEmailConfig();
if (!config.ok) { console.log(...); return; }
const { client, from } = config;
await client.emails.send({ from, to, subject, html });
```

Vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. Teste: `GET /api/test-email`.

## Estrutura
```
src/lib/{auth,email,prisma,session}.ts
src/lib/supabase/admin.ts          (só Storage)
src/app/(auth)/{login,esqueci-senha,redefinir-senha/[token]}
src/app/(dashboard)/{equipe,configuracoes,minha-conta,projetos,tarefas}
src/app/(dashboard)/@modal/(.)tarefas/[id]   (intercepting route → modal)
src/app/auth/callback                         (DESATIVADO, redirect /login)
```

## Modelos Prisma chave
`User` (passwordHash, mustChangePassword, isActive) · `PasswordResetToken` (token, expiresAt, usedAt) · `Task` (parentTaskId p/ subtarefa, projectId) · `Project` · `Company`

## Roles
admin > manager > supervisor > member. Admin/manager criam tarefas; member executa.

## Vars obrigatórias
`DATABASE_URL` `DIRECT_URL` `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `SESSION_SECRET` `NEXT_PUBLIC_APP_URL` `RESEND_API_KEY` `RESEND_FROM_EMAIL`

## Comportamentos importantes
- Usuário com `mustChangePassword: true` é forçado a `/minha-conta/senha`
- Modal de tarefa: `router.push(/projetos/${projectId})` se houver projeto, senão `router.back()`
- Antes de fazer mudanças grandes: rodar `npm run typecheck` (NÃO confie no narrowing de const de módulo — use vars locais após guard clause)
