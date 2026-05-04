# CLAUDE.md — ProcessosF3F

## Tech Stack

Next.js 15 (App Router) · TypeScript · Prisma ORM · PostgreSQL (Supabase) · Tailwind CSS · shadcn/ui · Vercel

---

## Always-Active Behaviors

### Caveman Ultra (default)
All prose responses in ultra mode. Abbreviate prose words (DB/auth/config/req/res/fn/impl), arrows for causality (X → Y), one word when one word enough. Code, function names, API names, error strings: never abbreviate.

### Karpathy Guidelines (every prompt)
1. **Think first** — state assumptions, surface tradeoffs, ask when unclear
2. **Simplicity** — min code that solves the problem, nothing speculative
3. **Surgical** — touch only what's needed, clean up only your own mess
4. **Goal-driven** — define verifiable success criteria before acting

---

## Quick Start

```bash
npm run dev          # dev server on :3000
npx tsc --noEmit     # type check
npx prisma studio    # DB GUI
npx prisma migrate dev --name <name>  # new migration
npx prisma generate  # regenerate client after schema change
```

---

## Architecture

```
src/
  app/
    (auth)/           # login, forgot-password, reset-password
    (dashboard)/      # authenticated area
      @modal/         # parallel route — intercepting modals
        (.)tarefas/[id]/    # task detail modal
        (.)tarefas/nova/    # new task modal
      dashboard/      # home
      tarefas/        # tasks CRUD + actions.ts
      projetos/       # projects + project detail
      clientes/       # clients CRUD
      setores/        # sectors
      equipe/         # team / users
      calendario/     # calendar
      templates/      # task templates
  components/
    ui/               # shared primitives (Button, Input, etc.)
    tasks/            # task-specific components
    layout/           # sidebar, top-bar
  lib/
    auth.ts           # requireAuth(), requireRole()
    prisma.ts         # Prisma singleton
    activity.ts       # logActivity()
    webhook.ts        # dispatchWebhook()
```

**Multi-tenant:** every query scoped by `companyId`. Pattern: check ownership with `companyId` before mutating by `id`.

**Auth roles:** `admin > manager > supervisor > member (colaborador)`

---

## Key Patterns

### Server Actions
- File: `actions.ts` co-located with the route
- Always `requireAuth()` at top
- Return `{ error?: string; success?: boolean }` — never throw
- `revalidatePath()` after mutations

### Intercepting Modals
- Modal route: `@modal/(.)tarefas/[id]/page.tsx`
- Close via `router.back()` (not `router.push`)
- Soft-nav links use `<LinkButton>` — never `<a href>` for internal nav

### Security
- Pre-check: `findFirst({ where: { id, companyId } })` before any mutation
- Never trust client-sent IDs without ownership verification

---

## Skills Available

### Project Skills (`/skill-name`)
| Skill | When to use |
|---|---|
| `/debug-issue` | Systematic bug hunt w/ knowledge graph |
| `/explore-codebase` | Navigate + understand structure |
| `/refactor-safely` | Safe refactor with dependency analysis |
| `/review-changes` | Structured code review |

### Code Review Graph (MCP active)
| Skill | When to use |
|---|---|
| `/build-graph` | Init or update knowledge graph |
| `/review-delta` | Review only changes since last commit |
| `/review-pr` | Full PR review with structural context |

### Context Mode
`/context-mode` · `/ctx-stats` · `/ctx-insight` · `/ctx-doctor` · `/ctx-upgrade` · `/ctx-purge`

### Caveman
`/caveman` · `/caveman lite` · `/caveman full` · `/caveman ultra` · `/caveman-commit` · `/caveman-review`

### Quality / Config
| Skill | When to use |
|---|---|
| `/simplify` | Review + fix changed code quality |
| `/fewer-permission-prompts` | Reduce permission noise |
| `/update-config` | Edit settings.json / hooks |
| `/security-review` | Audit pending changes |
| `/init` | Regenerate this CLAUDE.md |

### Vercel
`/vercel:deploy` · `/vercel:env` · `/vercel:status` · `/vercel:nextjs` · `/vercel:shadcn` · `/vercel:ai-sdk` · `/vercel:functions` · `/vercel:next-upgrade`

### Scheduling / Automation
`/loop` · `/schedule`

---

## MCP Plugins

| Plugin | Use for |
|---|---|
| **Supabase** | `execute_sql`, `apply_migration`, `get_logs` |
| **Obsidian** | Read/write to SecondBrain vault |
| **Google Calendar** | Scheduling integrations |
| **Google Drive** | File access |
| **Gmail** | Email automation |
| **Vercel** | Deployment management |

---

## Common Mistakes to Avoid

- `<a href>` for internal nav → breaks intercepting routes, use `<LinkButton>`
- Mutating by `id` without checking `companyId` → cross-tenant leak
- Adding `revalidatePath` without the matching route → stale UI
- Forgetting `npx prisma generate` after schema change → type errors
- Modal close with `router.push()` → use `router.back()`

---

**Last Updated:** 2026-05-04
