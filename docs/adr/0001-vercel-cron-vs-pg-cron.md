# ADR-0001: Vercel Cron para recorrência de tarefas

**Data:** 2026-05-04
**Status:** Aceito

## Contexto
A feature de recorrência precisa de um processo periódico para criar as próximas instâncias de tarefas recorrentes. As opções eram:

1. **Vercel Cron** — endpoint HTTP agendado, configurado em `vercel.ts`
2. **pg_cron** — extensão PostgreSQL que executa SQL diretamente no banco

## Decisão
Usar Vercel Cron.

## Motivo
- Código TypeScript versionável junto com o resto do projeto
- Reusa Prisma client — mesma camada de acesso a dados, sem SQL raw
- Logs centralizados na Vercel Dashboard
- Zero configuração adicional de infraestrutura (projeto já está na Vercel)
- Debugging mais simples: endpoint testável com `curl`

## Trade-offs aceitos
- Limite de 1 cron job por endpoint no plano Hobby (Pro: ilimitado)
- Latência de rede extra vs pg_cron que roda dentro do DB
- Depende de o serviço Vercel estar operacional (pg_cron independe)

## Implementação
- Endpoint: `GET /api/cron/recurrence`
- Schedule: `0 3 * * *` (3h UTC)
- Auth: `Authorization: Bearer $CRON_SECRET`
- Config: `vercel.ts` → `crons: [{ path: "/api/cron/recurrence", schedule: "0 3 * * *" }]`
