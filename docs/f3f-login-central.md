# Login central F3F — como este repo se integra

> Briefing auto-contido. Vale para qualquer agente/dev que mexer em auth neste repo.

## O que é

A F3F unificou a **credencial** (email + senha) de todos os sistemas internos num único banco: o Supabase principal **Agenciaf3f — ref `ulikfkemdawinetjyhok`**. Lá existem:

- `auth.users` — a senha (hash bcrypt, gerenciado pelo Supabase Auth: rate limit, lockout, reset token, tudo pronto);
- `public.f3f_logins` — quem tem acesso a qual sistema (`system`: `console-ads` | `task` | `kpi-hub` | `hub`), com flag `active`;
- edge functions `f3f-auth-check`, `f3f-auth-provision`, `f3f-auth-deactivate`, `f3f-auth-set-password`.

**O que NÃO foi unificado — regra, não sugestão:** cargo, papel, permissão, setor, empresa e qualquer regra de autorização **continuam neste banco local**, exatamente como estão. A mudança é só autenticação (provar quem é). Se você está mexendo em `users.role`, `requireRole`, `companyId` — saiu do escopo.

## Como este repo (Tasks) usa o central — "Modo A"

O Tasks tem backend próprio (Next.js + Prisma, sem RLS), então a integração é **server-side, na validação de senha**:

1. `loginUser` (`src/lib/auth.ts`) continua buscando a linha local em `users` (é ela que dá `role`, `companyId`, `isActive`).
2. Com o central habilitado, a senha é validada por `centralVerifyPassword` (`src/lib/f3f-central.ts`): `signInWithPassword` no `ulik` + `f3f-auth-check` com `{ system: 'task' }`.
3. Passou → **mesmo cookie iron-session de sempre** (`f3f_session`). Nada muda depois do login.
4. Sem as envs do central → fallback bcrypt local (comportamento legado). Isso permite deployar o código antes de migrar os usuários.

Trocas de senha (`minha-conta/senha`, `redefinir-senha/[token]`) gravam o hash local **e** propagam ao central via `centralSetPasswordEverywhere` — que também sincroniza o espelho do Console.Ads pela edge `f3f-auth-set-password`. Convite de membro (`equipe/actions.ts`) provisiona no central via `centralProvisionTaskUser`; se a pessoa já tinha conta F3F, a senha dela **não muda** e o email diz "use sua senha F3F".

## Envs (server-only, nunca `NEXT_PUBLIC`)

```
F3F_CENTRAL_SUPABASE_URL=https://ulikfkemdawinetjyhok.supabase.co
F3F_CENTRAL_SUPABASE_ANON_KEY=...      # habilita o login central
F3F_CENTRAL_SERVICE_ROLE_KEY=...       # provisionamento/troca de senha (só servidor)
```

## Cutover (uma vez)

```bash
npx tsx scripts/migrate-users-to-central.ts --dry-run   # confere
npx tsx scripts/migrate-users-to-central.ts             # importa hashes → senha preservada
# setar as 3 envs na Vercel → deploy → validar 1 login
# depois de estável: update users set password_hash = '';  -- mata a credencial local
```

## Proibido (cada item já deu problema real no ecossistema F3F)

1. Senha em texto em tabela (o KPI hub tinha `client_dashboards.senha` em claro — não repita).
2. Senha por email quando dá pra mandar link.
3. `service_role` no browser / em env `NEXT_PUBLIC`.
4. Assumir que JWT de um projeto Supabase vale em outro (não vale; é rejeitado antes de qualquer policy).
5. Mover cargo/permissão para o central.

## Checklist de aceite

- [ ] Senha errada → "Credenciais inválidas"; senha certa → dashboard.
- [ ] Pessoa sem linha `f3f_logins` (`system='task'`) → recusada mesmo com senha certa.
- [ ] `active=false` no central → login recusado.
- [ ] Cargo continua funcionando (admin vê /equipe; member não).
- [ ] `npx tsc --noEmit` limpo.
