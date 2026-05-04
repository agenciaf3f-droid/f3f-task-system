# ADR-0003: Multi-tenant por companyId em todas as queries

**Data:** 2026-05-04
**Status:** Aceito

## Contexto
O sistema serve múltiplas empresas (agências) no mesmo banco. Precisávamos de isolamento de dados sem schemas separados.

## Decisão
Toda query de leitura e mutação inclui `companyId` como filtro obrigatório. Padrão: `findFirst({ where: { id, companyId: user.companyId } })` antes de qualquer mutação.

## Por quê
- Isolamento simples via SQL — sem Row Level Security do Postgres (RLS depende de configuração externa, falha silenciosa se esquecer)
- Verificação em código TypeScript → erro em dev, não em prod
- `requireAuth()` sempre retorna `companyId` do usuário autenticado — não há como o cliente falsificar

## Regras derivadas
1. **Nunca** mutar por `id` só — sempre `{ id, companyId: user.companyId }`
2. `requireAuth()` obrigatório no topo de todo server action
3. Dados de outras companies jamais devem aparecer em selects (mesmo que "públicos")
4. Em relations, o `companyId` do pai é suficiente — não duplicar em tabelas filhas que não fazem sentido sem o pai

## Trade-offs aceitos
- Queries mais verbosas vs RLS transparente
- Responsabilidade de isolamento no código da app, não no DB
