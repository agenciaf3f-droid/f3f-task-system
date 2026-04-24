# F3F Task System — Guia para Claude

Sistema interno de gestão de tarefas e produtividade da empresa F3F.
Deploy em produção: https://f3f-task-system.vercel.app

---

## Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Banco de dados:** PostgreSQL via Supabase (só o banco — Auth do Supabase NÃO é usado)
- **ORM:** Prisma
- **Autenticação:** bcryptjs + iron-session (sessão no cookie)
- **Email:** Resend (`src/lib/email.ts`)
- **Storage (avatares):** Supabase Storage via `supabaseAdmin`
- **UI:** Tailwind CSS v4 + shadcn/ui + Lucide icons
- **Deploy:** Vercel

---

## Autenticação — IMPORTANTE

O Supabase Auth foi completamente removido. O sistema usa:

1. **Login** → `prisma.user.findUnique` + `bcryptjs.compare` contra `passwordHash`
2. **Sessão** → `iron-session` (cookie encriptado com `SESSION_SECRET`)
3. **Logout** → `session.destroy()`
4. **Reset de senha** → token gerado com `crypto.randomBytes`, salvo em `PasswordResetToken`, link enviado via Resend
5. **Convite de usuário** → senha temporária gerada, hash salvo no banco, credenciais enviadas via Resend

**Nunca usar** `supabase.auth.*` para login, logout, reset de senha ou convites.
O `supabaseAdmin` existe apenas para Supabase Storage (upload de avatares).

---

## Emails

Todos os emails são enviados via **Resend** (`src/lib/email.ts`):

- `sendInviteEmail` — convite de novo membro com senha temporária
- `sendPasswordResetEmail` — link de reset de senha
- `sendTaskAssignedEmail` — notificação de tarefa atribuída
- `sendDueReminderEmail` — lembrete de prazo

Variáveis de ambiente necessárias:
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=F3F Tasks <noreply@dominio.com>
```

Endpoint de teste: `GET /api/test-email`

---

## Estrutura de pastas relevante

```
src/
  lib/
    auth.ts          — loginUser, logoutUser, requireAuth, requireRole
    email.ts         — todas as funções de envio de email (Resend)
    prisma.ts        — cliente Prisma singleton
    session.ts       — configuração iron-session
    supabase/
      admin.ts       — supabaseAdmin (APENAS para Storage)
      server.ts      — cliente Supabase SSR (não usar para auth)
  app/
    (auth)/
      login/         — página e action de login (bcrypt)
      esqueci-senha/ — solicitar reset (gera token + envia Resend)
      redefinir-senha/[token]/ — validar token e salvar nova senha
    (dashboard)/
      equipe/        — convidar/gerenciar membros (envia email via Resend)
      configuracoes/ — trocar senha (bcrypt, sem Supabase)
      minha-conta/   — troca obrigatória de senha no 1º acesso
    @modal/(.)tarefas/[id]/ — intercepting route: abre tarefa como modal
    auth/callback/   — DESATIVADO (era para Supabase OAuth, redireciona para /login)
```

---

## Banco de dados

Modelos principais do Prisma:

- `Company` — empresa/tenant
- `User` — usuário com `passwordHash`, `mustChangePassword`, `isActive`
- `Task` — tarefa com status, priority, assignee, dueDate, checklist, subtasks
- `Project` — projeto agrupador de tarefas
- `PasswordResetToken` — token de reset com `expiresAt` e `usedAt`
- `Template` / `TemplateTask` — templates de processo
- `Notification`, `ActivityLog` — auditoria

---

## Variáveis de ambiente obrigatórias

```
DATABASE_URL=          # PostgreSQL Supabase (pooler)
DIRECT_URL=            # PostgreSQL Supabase (direct, para migrations)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # só para Storage
SESSION_SECRET=        # mínimo 32 chars
NEXT_PUBLIC_APP_URL=https://f3f-task-system.vercel.app
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

---

## Regras de negócio importantes

- Roles: `admin` > `manager` > `supervisor` > `member`
- Admin e manager podem criar tarefas; member só executa
- Usuário novo recebe `mustChangePassword: true` → forçado a trocar no 1º acesso
- Tarefas podem ter subtarefas (campo `parentTaskId`)
- Tarefas dentro de projetos abrem como **modal** via intercepting route (`@modal`)
- `router.back()` no modal volta para o projeto caso `projectId` exista, senão volta no histórico
