import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  NPS_SHEETS,
  RESUMO,
  UTM_NAMES,
  agrupaPorGestor,
  badgeGeral,
  calc,
  corDaMeta,
  carregaAba,
  carregaTodasAbas,
  type Aba,
  type Resposta,
} from "@/lib/nps";
import { NpsGauge } from "./nps-gauge";
import { GestorCard } from "./gestor-card";
import { GestorFilter, MonthFilter } from "./nps-filters";
import { EvolutionChart } from "./evolution-chart";

export const metadata = { title: "NPS · F3F Task" };

// A planilha muda ao longo do dia conforme os clientes respondem; cachear a
// página inteira devolveria número velho sem ninguém perceber.
export const dynamic = "force-dynamic";

const MESES = Object.keys(NPS_SHEETS);
const ULTIMO_MES = MESES[MESES.length - 1];

export default async function NpsPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; gestor?: string }>;
}) {
  const user = await requireRole(["admin", "manager"]);
  const sp = await searchParams;

  // Mês desconhecido na URL cai no mais recente, que é o padrão da tela.
  const mesParam = sp.mes && (sp.mes === RESUMO || NPS_SHEETS[sp.mes]) ? sp.mes : ULTIMO_MES;
  const ehResumo = mesParam === RESUMO;
  const gestorFiltro = sp.gestor && UTM_NAMES[sp.gestor] ? sp.gestor : "";

  let abas: Aba[] = [];
  let faltando = 0;
  let erro: string | null = null;

  try {
    if (ehResumo) {
      const r = await carregaTodasAbas();
      abas = r.abas;
      faltando = r.faltando;
      if (!abas.length) throw new Error("nenhuma aba pôde ser carregada");
    } else {
      abas = [await carregaAba(mesParam)];
    }
  } catch (e) {
    // Sem dados a tela fica zerada de propósito: mostrar os números do mês
    // anterior sob o nome do mês novo seria pior do que não mostrar nada.
    erro = e instanceof Error ? e.message : "erro desconhecido";
  }

  const filtra = (arr: Resposta[]) =>
    gestorFiltro ? arr.filter((d) => d.utmAtual === gestorFiltro) : arr;

  const todas = filtra(abas.flatMap((a) => a.data));
  const statsGestor = calc(todas.map((d) => d.notaGestor));
  const statsAgencia = calc(todas.map((d) => d.notaAgencia));
  const porGestor = agrupaPorGestor(todas);

  // Seletor de gestor: sai de quem respondeu em qualquer mês carregado.
  const gestoresDisponiveis = [...new Set(abas.flatMap((a) => a.data.map((d) => d.utmAtual)))]
    .filter((u) => UTM_NAMES[u])
    .sort((a, b) => UTM_NAMES[a].localeCompare(UTM_NAMES[b]))
    .map((utm) => ({ utm, nome: UTM_NAMES[utm] }));

  const meta = ehResumo ? null : await calculaMeta(user.companyId, todas.length, gestorFiltro);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">NPS — Clientes</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {erro
              ? "Não foi possível carregar a pesquisa"
              : ehResumo
                ? `${todas.length} respostas em ${abas.length} ${abas.length === 1 ? "mês" : "meses"}`
                : `${todas.length} respostas · ${abas[0]?.label ?? ""}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthFilter value={mesParam} options={MESES} resumoValue={RESUMO} />
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-[0.78rem] font-medium text-rose-700">
          Não foi possível carregar {ehResumo ? "o resumo" : mesParam.replace("Formulário NPS - ", "")} ({erro}). Os
          números foram limpos para não mostrar dados de outro mês — recarregue a página para tentar de novo.
        </div>
      )}

      {faltando > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-[0.78rem] font-medium text-amber-700">
          {faltando} {faltando === 1 ? "mês não pôde" : "meses não puderam"} ser carregados e ficaram de fora do
          resumo. Recarregue a página para tentar de novo.
        </div>
      )}

      {/* Evolução: só no Resumo. O seletor de gestor fica aqui, e não na barra
          do topo, porque só faz sentido nesta visão — no mês, a quebra por
          gestor já são os cards de baixo. */}
      {ehResumo && abas.length > 0 && (
        <section>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[0.68rem] font-bold tracking-[0.09em] text-neutral-500 uppercase">
              Evolução do NPS
            </h2>
            <label className="flex items-center gap-2 text-[0.75rem] text-neutral-500">
              Gestor:
              <GestorFilter value={gestorFiltro} options={gestoresDisponiveis} />
            </label>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-[0.75rem] text-neutral-500">
              NPS de cada mês de pesquisa. Mês sem resposta fica como buraco na linha, não como zero — zero seria
              lido como nota péssima. Escolha um gestor para ver a linha dele.
            </p>
            <EvolutionChart
              labels={abas.map((a) => a.label)}
              gestor={abas.map((a) => serie(filtra(a.data), "notaGestor"))}
              agencia={abas.map((a) => serie(filtra(a.data), "notaAgencia"))}
              totais={abas.map((a) => filtra(a.data).length)}
            />
          </div>
        </section>
      )}

      {/* Meta some no Resumo: ela é mensal, e somada entre meses não quer dizer
          nada — seis meses de alvo contra seis meses de resposta não significa
          nada. */}
      {meta && (
        <section>
          <h2 className="mb-3.5 text-[0.68rem] font-bold tracking-[0.09em] text-neutral-500 uppercase">
            Meta de Respostas
          </h2>
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[0.85rem] font-bold text-neutral-900">Respostas coletadas</div>
                <div className="text-[0.7rem] text-neutral-500">{meta.sub}</div>
              </div>
              <div className="text-[1.9rem] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-neutral-900 tabular-nums">
                {todas.length}
                {meta.alvo > 0 && <span className="text-base font-bold text-neutral-500"> / {meta.alvo}</span>}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${meta.cor}`}
                style={{ width: `${meta.pct}%` }}
              />
            </div>
            {meta.foot && <div className="mt-2 text-[0.72rem] font-medium text-neutral-500">{meta.foot}</div>}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3.5 text-[0.68rem] font-bold tracking-[0.09em] text-neutral-500 uppercase">
          Indicadores Gerais
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CardIndicador
            titulo="NPS do Gestor"
            sub="Satisfação com o gestor de tráfego"
            stats={statsGestor}
          />
          <CardIndicador
            titulo="NPS da Agência"
            sub="Satisfação com a agência F3F"
            stats={statsAgencia}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3.5 text-[0.68rem] font-bold tracking-[0.09em] text-neutral-500 uppercase">
          NPS por Gestor
        </h2>
        {porGestor.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center text-[0.8rem] text-neutral-400 shadow-sm">
            Sem dados carregados para este mês.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {porGestor.map((g) => (
              <GestorCard key={g.utm} nome={g.nome} items={g.items} stats={g.stats} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** NPS de um mês para uma das duas perguntas. Mês vazio vira buraco na linha. */
function serie(data: Resposta[], campo: "notaGestor" | "notaAgencia") {
  if (!data.length) return null;
  return calc(data.map((d) => d[campo])).nps;
}

function CardIndicador({
  titulo,
  sub,
  stats,
}: {
  titulo: string;
  sub: string;
  stats: ReturnType<typeof calc>;
}) {
  const badge = badgeGeral(stats.nps);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-7 text-center shadow-sm">
      <div className="text-[0.85rem] font-bold text-neutral-900">{titulo}</div>
      <div className="text-[0.7rem] text-neutral-500">{sub}</div>
      <NpsGauge valor={stats.nps} />
      <div className="mb-2">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-[0.67rem] font-bold ${badge.className}`}
        >
          {badge.label}
        </span>
        <span className="ml-1.5 text-[0.7rem] text-neutral-500">{stats.total} respostas</span>
      </div>
      <div className="mt-2.5 flex justify-center gap-5 text-[0.72rem] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" /> {stats.promotores} Promotores
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-500" /> {stats.neutros} Neutros
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> {stats.detratores} Detratores
        </span>
      </div>
    </div>
  );
}

/**
 * Meta do mês: metade dos clientes ativos precisa responder.
 *
 * No KPI-HUB o denominador vinha de uma segunda planilha ("Controle dos
 * Grupos"). Aqui os clientes já estão no banco, então a conta sai daqui mesmo —
 * uma fonte a menos para cair. Com filtro de gestor, a meta é a carteira dele.
 *
 * O número é o de hoje, não o daquele mês: o banco guarda a carteira atual, sem
 * histórico de quem era ativo em cada mês. Por isso o rótulo diz "ativos hoje",
 * para ninguém ler como se fosse a base da época.
 */
async function calculaMeta(companyId: string, respostas: number, gestorFiltro: string) {
  const nomeGestor = gestorFiltro ? UTM_NAMES[gestorFiltro] : "";

  const ativos = await prisma.client.count({
    where: {
      companyId,
      deletedAt: null,
      ...(nomeGestor
        ? { manager: { name: { startsWith: nomeGestor, mode: "insensitive" }, deletedAt: null } }
        : {}),
    },
  });

  if (!ativos) {
    // Sem base de clientes não dá para afirmar meta nenhuma; melhor dizer isso
    // do que desenhar uma barra sobre um denominador inventado.
    return {
      alvo: 0,
      pct: 0,
      cor: "bg-neutral-200",
      sub: nomeGestor
        ? `Não encontramos clientes ativos no nome de ${nomeGestor} para calcular a meta.`
        : "Não foi possível contar os clientes ativos para calcular a meta.",
      foot: "",
    };
  }

  const alvo = Math.ceil(ativos / 2);
  const pct = Math.min(100, Math.round((respostas / alvo) * 100));
  const faltam = alvo - respostas;

  return {
    alvo,
    pct,
    cor: corDaMeta(respostas, alvo, pct),
    sub: `Meta: metade dos ${ativos} clientes ativos hoje${nomeGestor ? ` na carteira de ${nomeGestor}` : ""}`,
    foot:
      respostas >= alvo
        ? `Meta batida — ${respostas} de ${alvo} (${pct}%)`
        : `${faltam === 1 ? "Falta 1 resposta" : `Faltam ${faltam} respostas`} para bater a meta (${pct}%)`,
  };
}
