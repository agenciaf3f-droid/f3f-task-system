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
    (dashboard)/      # authenticated area (f3f_session cookie)
      @modal/         # parallel route — intercepting modals
        (.)tarefas/[id]/    # task detail modal
        (.)tarefas/nova/    # new task modal
      dashboard/      # home
      tarefas/        # tasks CRUD + actions.ts
      projetos/       # projects + project detail
      clientes/       # clients CRUD
      setores/        # sectors
      equipe/         # team / users
      calendario/     # gestor's calendar + availability dialog
      templates/      # task templates
    agendar/[token]/  # PUBLIC booking page (no dashboard auth)
      login/          # client login (separate auth — external DB)
      booking-form.tsx
    api/agendar/[token]/
      auth/route.ts   # POST: client credentials → f3f_client_session
      book/route.ts   # POST: create Meeting + Google Calendar event
    api/cron/sync-clients/route.ts # GET: planilha pública → Client
  components/
    ui/               # shared primitives
    tasks/            # task-specific components
    layout/           # sidebar, top-bar
  lib/
    auth.ts           # requireAuth(), requireRole() — dashboard
    client-session.ts # iron-session for /agendar clients
    external-db.ts    # findClientByCredentials() → external Supabase
    google-calendar.ts# createCalendarMeeting() / deleteCalendarMeeting()
    meeting-recurrence.ts # todayInBrazil(), currentYearMonthInBrazil()
    prisma.ts         # Prisma singleton
    activity.ts       # logActivity()
    webhook.ts        # dispatchWebhook()
```

**Multi-tenant:** every query scoped by `companyId`. Pattern: check ownership with `companyId` before mutating by `id`.

**Auth roles:** `admin > manager > supervisor > member (colaborador)`

---

## Authentication Systems (TWO separate)

| Sistema | Rota | Banco | Senha | Sessão |
|---|---|---|---|---|
| Dashboard | `/login` | Interno (`User`, Prisma) | bcrypt | `f3f_session` |
| Agendamento público | `/agendar/[token]/login` | **Externo** (`client_dashboards`, Supabase separado) | **plaintext** (fallback `"123456"` se null) | `f3f_client_session` |

**Env vars externas:**
- `EXTERNAL_SUPABASE_URL` · `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`
- `EXTERNAL_CLIENT_TABLE` (default: `client_dashboards`)
- `EXTERNAL_FIELD_EMAIL` · `EXTERNAL_FIELD_PASSWORD` · `EXTERNAL_FIELD_NAME` · `EXTERNAL_FIELD_PLAN` · `EXTERNAL_FIELD_GROUP_ID` · `EXTERNAL_FIELD_MANAGER_ID`

Banco externo NÃO é controlado por esta app — apenas leitura para login. Hash de senha não é viável (outra fonte alimenta).

---

## Booking Flow (`/agendar`)

Fluxo principal (sem login):
1. No perfil `/projetos?clientId=...`, `Agendar reunião` chama `sendClientBookingLinkAction()`
2. A action usa `Client.meetingPlan` + `Client.whatsappGroupId`; clientes legados usam o banco externo por e-mail (fallback único por nome)
3. Cria `BookingMagicLink`: token aleatório, apenas SHA-256 salvo, validade de 7 dias
4. `sendWhatsAppText()` envia a mensagem diretamente para `POST {UAZAPI_SERVER_URL}/send/text`
5. Cliente abre `/agendar/acesso/[token]` → token válido cria `f3f_client_session` e redireciona para a agenda do gestor
6. Cliente escolhe horário (respeitando `CalendarAvailability`) → `POST /api/agendar/[token]/book`
7. Duração e recorrência vêm de `clientPlan`; o cliente não escolhe nem envia essas regras
8. Cria `Meeting` + evento Google Calendar. Recorrentes geram 12 ocorrências; conflitos futuros são ignorados

Fluxo legado por login continua disponível em `/agendar/[token]/login` para links antigos.

Configuração UAZAPI (server-only):
- `UAZAPI_SERVER_URL`: URL da instância
- `UAZAPI_INSTANCE_TOKEN`: token Sensitive da instância
- `UAZAPI_MODE`: `test` ou `production`
- `UAZAPI_TEST_GROUP_ID`: destino obrigatório durante a homologação
- O endpoint precisa responder HTTP 2xx para o Task considerar o envio confirmado.

Protocolo obrigatório de testes do WhatsApp:
- Todo envio de teste deve usar exclusivamente o grupo **`F3F - Arthur - 16 FASES`**.
- JID autorizado para testes: **`120363290811576538@g.us`**.
- Nunca testar mensagens automáticas em grupos reais de outros clientes.
- Credenciais e tokens da UAZAPI devem existir apenas como secrets de ambiente; nunca em código, commits, logs ou documentação.
- Antes de qualquer teste, resolver e validar o JID do grupo selecionado (`...@g.us`) e bloquear o envio se ele não corresponder ao grupo autorizado.
- Em `UAZAPI_MODE=test`, o servidor força o JID autorizado, ignorando o destino do cliente.

---

## Lembretes de reunião no WhatsApp

Quatro avisos por reunião, no grupo do cliente (`Meeting.clientGroupId`):

| Lembrete | Quando | Envio |
|---|---|---|
| `day_before` | véspera às `MEETING_REMINDER_DAY_BEFORE_HOUR` (default 06:00) | `/send/menu` com 2 botões |
| `morning` | dia da reunião às 06:00 | `/send/text` |
| `hour_before` | 1h antes | `/send/text` |
| `minutes_before` | 5 min antes | `/send/text` |

- **Disparo:** GitHub Actions a cada 5 min (`meeting-reminders.yml`, OIDC audience `f3f-task-meeting-reminders`) → `/api/cron/meeting-reminders`. Não usa Vercel Cron: o plano Hobby só aceita 1x/dia.
- **Atraso do agendador:** o GitHub atrasa com frequência, então cada lembrete tem janela de tolerância (`targetFor()`). Fora da janela o aviso é descartado — nunca chega depois da reunião.
- **Idempotência:** unique `[meetingId, kind]` em `MeetingReminder`. A linha é criada ANTES do envio, então falha de rede não vira mensagem duplicada. Retenta só se o status ficou `failed`, no máximo 3x.
- **Botões:** ids `f3f-sim:<meetingId>` / `f3f-nao:<meetingId>` voltam em `/api/webhooks/uazapi` (autenticado por `UAZAPI_WEBHOOK_TOKEN` na query).
  - "Sim" → `Meeting.clientResponse = "confirmed"`, aparece com ✓ no `/calendario`.
  - "Não" → cancela de verdade: `status = "cancelled"` + apaga evento do Google Calendar + libera o horário.
- **Formato do payload de clique NÃO está na spec da UAZAPI** — foi capturado via `/message/find`. O id tocado vem em `buttonOrListid` e `content.selectedButtonID`; `messageType` é `ButtonsResponseMessage`. **`contextInfo.quotedMessage` repete os DOIS ids** em `buttonParamsJSON`, então o payload de uma confirmação contém a string `f3f-nao:`. Por isso `extractButtonResponse()` só lê chaves que afirmam a escolha — varrer o JSON inteiro cancelaria reunião confirmada. Em caso de ambiguidade recusa e loga a *forma* do payload (sem valores, que contêm dado de cliente).
- **Liga/desliga:** `MEETING_REMINDERS_ENABLED` precisa ser exatamente `true` para disparar. Ausente, vazia ou qualquer outro valor = desligado, sem precisar de deploy. É opt-in porque errar para o lado ligado custa mensagem indevida em grupo de cliente.
- **Configurar webhook na instância:** `npm run uazapi:webhook -- --apply`.

---

## Sincronização automática de clientes

- **Fonte:** CSV público da planilha de grupos F3F.
- **Cron principal:** GitHub Actions chama `/api/cron/sync-clients` a cada 10 minutos usando OIDC assinado e restrito ao workflow da `main`.
- **Fallback:** Vercel executa a mesma rota uma vez ao dia via `vercel.json`, autenticada por `CRON_SECRET`.
- **Campos:** `Grupo`, `Gestor Responsável`, `Status`, `ID Grupo (Uazapi)` e `Plano`.
- **Identidade:** `ID Grupo (Uazapi)`; fallback por nome apenas para cliente legado sem ID.
- **Ativo:** cria, atualiza ou restaura o cliente e vincula o gestor interno pelo nome.
- **Inativo:** arquiva cliente existente; nunca cria cliente inativo.
- Linhas sem ID UAZAPI, plano ou gestor válidos são ignoradas e registradas no resultado do cron.

---

## Google Calendar Integration

- **File:** `src/lib/google-calendar.ts`
- **Auth:** OAuth2 refresh token
  - `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REFRESH_TOKEN`
- **Calendar por plano:** `GOOGLE_CALENDAR_ID_${PLAN.toUpperCase()}` → fallback `GOOGLE_CALENDAR_ID`
- **Event title:** `${clientName} — ${startTime}` (ou `Reunião — ${ownerName}` se sem cliente)
- **Event description:** `Group ID: ${clientGroupId}`
- **Timezone:** `GOOGLE_CALENDAR_TIMEZONE` (default `America/Sao_Paulo`)
- **Best-effort:** falha não bloqueia booking — loga `[GCal] Erro...` e segue

**Calendário do dashboard (`/calendario`):** mostra `clientName || hostName` + horário. Cor por gestor (`colorForHost(hostId)`).

---

## Prisma Models (key fields)

- **User**: + `calendarSlug` (unique, nullable), `calendarToken` (unique, nullable) — para link público
- **CalendarAvailability**: `userId`, `dayOfWeek` (0-6), `startTime`, `endTime` (HH:MM); unique `[userId, dayOfWeek]`
- **Client**: + `meetingPlan`, `whatsappGroupId`, `whatsappGroupName` para agendamento sem lookup frágil
- **Meeting**: `userId`, `date` (YYYY-MM-DD), `startTime`, `endTime`, `status` (default `confirmed`), `googleEventId`, `clientName`, `clientGroupId`, `clientPlan`, `recurrenceRule` (JSON), `recurrenceParentId` (self); unique `[userId, date, startTime]`

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
- Confundir os DOIS auth systems: `/login` (dashboard, bcrypt) ≠ `/agendar/.../login` (cliente público, banco externo plaintext)
- Usar `new Date()` cru para "hoje" → use `todayInBrazil()` (timezone-aware)

---

**Last Updated:** 2026-05-12
