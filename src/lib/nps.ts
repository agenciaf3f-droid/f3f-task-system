/**
 * NPS dos clientes — leitura do formulário de pesquisa.
 *
 * A pesquisa vive numa planilha do Google publicada como CSV: uma aba por mês
 * de pesquisa, cada uma com seu gid. Não há banco por trás — a fonte é a mesma
 * que o painel do KPI-HUB já lia, para os dois lados nunca divergirem.
 *
 * Tudo aqui roda no servidor: o CSV é público, mas buscá-lo no browser de cada
 * pessoa que abre a tela multiplicaria as chamadas ao Google sem ganho nenhum.
 */

const PUB_BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT43xO8ZBg4o1_2z6sniZ1BogNIkQzWeXNwJ1PbnQ8WEAkjrO9c5TgwObZvqQsz1dR95A_gK7le1my8/pub";

/** Uma aba por mês de pesquisa. A ordem daqui é a ordem do seletor. */
export const NPS_SHEETS: Record<string, number> = {
  "Formulário NPS - Janeiro": 870439944,
  "Formulário NPS - Fevereiro": 501408772,
  "Formulário NPS - Março": 1564651329,
  "Formulário NPS - Abril": 210580385,
  "Formulário NPS - Maio": 1474077717,
  "Formulário NPS - Julho": 1451590710,
};

/** utm_source do link da pesquisa → gestor que o enviou. */
export const UTM_NAMES: Record<string, string> = {
  "1": "Yuri",
  "2": "Raphael",
  "3": "Gabriel",
  "4": "Guilherme",
  "5": "Rafhael",
  "6": "Diogo",
};

/** Valor sentinela do seletor de mês: carrega todas as abas de uma vez. */
export const RESUMO = "__resumo__";

export type Resposta = {
  utm: string;
  utmAtual: string;
  gestorAnterior: string | null;
  notaGestor: number;
  feedbackGestor: string;
  notaAgencia: number;
  feedbackAgencia: string;
};

export type MesRef = { ano: number; mes: number; label: string; inicio: Date };

export type Aba = {
  name: string;
  label: string;
  data: Resposta[];
  mesRef: MesRef | null;
};

export type Stats = {
  nps: number;
  promotores: number;
  neutros: number;
  detratores: number;
  total: number;
};

/**
 * Cliente que trocou de gestor vem com utm_source de 2 dígitos: o primeiro é o
 * gestor de hoje, o segundo o gestor antigo. Ex.: "61" = hoje é do Diogo, antes
 * era do Yuri. A resposta conta para o gestor atual; o antigo vira só um aviso
 * na tela. Código que não casar com esse formato cai no comportamento de antes.
 */
export function parseUtm(utm: string | null | undefined) {
  const raw = (utm == null ? "" : String(utm)).trim();
  if (UTM_NAMES[raw]) return { atual: raw, anterior: null as string | null };
  if (raw.length === 2 && UTM_NAMES[raw[0]] && UTM_NAMES[raw[1]] && raw[0] !== raw[1]) {
    return { atual: raw[0], anterior: raw[1] as string | null };
  }
  return { atual: raw, anterior: null as string | null };
}

/** CSV do Google: vírgula como separador, aspas duplas escapando o conteúdo. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(cell);
      cell = "";
    } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      current.push(cell);
      cell = "";
      if (ch === "\r") i++;
      rows.push(current);
      current = [];
    } else if (ch === "\r") {
      current.push(cell);
      cell = "";
      rows.push(current);
      current = [];
    } else {
      cell += ch;
    }
  }
  if (cell || current.length) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}

/** "27/01/2026 02:25:02" — só a data interessa, e só para descobrir o ano. */
function parseDataEnvio(valor: unknown): Date | null {
  const s = (valor == null ? "" : String(valor)).trim();
  if (!s) return null;
  const dia = s.split(" ")[0];
  const br = dia.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = dia.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

/**
 * Converte as linhas do CSV em respostas.
 *
 * As colunas são descobertas pelo cabeçalho porque as perguntas foram
 * reescritas ao longo do ano e a posição delas muda de mês para mês. Os índices
 * fixos no fim são o layout de janeiro, que é o único sem cabeçalho reconhecível.
 */
function extraiRespostas(rows: string[][]) {
  const header = rows[0] || [];
  let colGestor = -1;
  let colAgencia = -1;
  let colUtm = -1;
  let colData = -1;

  header.forEach((h, idx) => {
    const hl = (h || "").toLowerCase().trim();
    if (hl.includes("satisfeito com seu gestor") || hl.includes("satisfeito com o seu gestor")) {
      colGestor = idx;
    } else if (hl.includes("satisfeito") && (hl.includes("agência") || hl.includes("agencia"))) {
      colAgencia = idx;
    }
    if (hl === "utm_source" || hl === "utm\\_source" || hl === "utm source") colUtm = idx;
    // Só para descobrir o ANO da aba — o mês vem do nome dela.
    if (hl === "submitted at" || hl === "timestamp") colData = idx;
  });

  // O texto do feedback vem sempre na coluna seguinte à da nota.
  let colFbGestor = colGestor >= 0 ? colGestor + 1 : -1;
  let colFbAgencia = colAgencia >= 0 ? colAgencia + 1 : -1;

  if (colGestor < 0) colGestor = 3;
  if (colFbGestor < 0) colFbGestor = 4;
  if (colAgencia < 0) colAgencia = 5;
  if (colFbAgencia < 0) colFbAgencia = 6;
  if (colUtm < 0) colUtm = 7;

  const data: Resposta[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < colUtm + 1) continue;
    const utm = (r[colUtm] || "").toString().trim();
    if (!utm) continue;
    const notaGestor = parseFloat(r[colGestor]);
    const notaAgencia = parseFloat(r[colAgencia]);
    if (isNaN(notaGestor) && isNaN(notaAgencia)) continue;
    const p = parseUtm(utm);
    data.push({
      utm,
      utmAtual: p.atual,
      gestorAnterior: p.anterior ? UTM_NAMES[p.anterior] : null,
      notaGestor,
      feedbackGestor: (r[colFbGestor] || "").trim(),
      notaAgencia,
      feedbackAgencia: (r[colFbAgencia] || "").trim(),
    });
  }

  const datas: Date[] = [];
  if (colData >= 0) {
    for (let i = 1; i < rows.length; i++) {
      const d = parseDataEnvio((rows[i] || [])[colData]);
      if (d) datas.push(d);
    }
  }

  return { data, datas };
}

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

/**
 * Descobre a que mês/ano a aba se refere. O MÊS vem do nome da aba, não das
 * datas de envio: a pesquisa de um mês costuma ser respondida no mês seguinte
 * (a aba de Março tem 37 respostas de abril contra 8 de março), então a data de
 * envio não serve como mês de referência.
 *
 * O ANO sai da resposta mais antiga, que é a que fica mais perto do mês de
 * referência. O ajuste de virada cobre a aba de dezembro respondida em janeiro.
 */
function mesReferencia(nomeAba: string, datas: Date[]): MesRef | null {
  const label = nomeAba.replace("Formulário NPS - ", "").trim();
  const mes = MESES[label.toLowerCase()];
  if (mes === undefined) return null;
  const validas = datas.filter(Boolean).sort((a, b) => a.getTime() - b.getTime());
  if (!validas.length) return null;
  let ano = validas[0].getFullYear();
  if (mes - validas[0].getMonth() > 6) ano -= 1;
  return { ano, mes, label, inicio: new Date(ano, mes, 1) };
}

/**
 * O Google às vezes engasga e a requisição estoura o tempo. Costuma passar na
 * tentativa seguinte, então insistimos — mas só quando o erro é de tempo:
 * planilha despublicada ou gid errado não melhora com retry, e nesses casos
 * falhar rápido é melhor.
 */
async function fetchCsv(url: string, tentativas: number): Promise<string> {
  let ultimoErro: unknown = null;
  for (let i = 0; i < tentativas; i++) {
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(15000 + i * 10000),
        cache: "no-store",
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const text = await resp.text();
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        throw new Error("Google retornou HTML em vez de CSV. Verifique se a planilha está publicada.");
      }
      return text;
    } catch (e) {
      ultimoErro = e;
      const nome = e instanceof Error ? e.name : "";
      const msg = e instanceof Error ? e.message : "";
      const ehTempo =
        nome === "TimeoutError" || nome === "AbortError" || /timed out|timeout|network/i.test(msg);
      if (!ehTempo || i === tentativas - 1) break;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw ultimoErro;
}

/** Baixa e converte UMA aba do formulário em respostas. */
export async function carregaAba(name: string): Promise<Aba> {
  const gid = NPS_SHEETS[name];
  if (!gid) throw new Error("Mês não encontrado: " + name);
  // Parâmetro descartável na URL: o Google devolve a planilha publicada com
  // `cache-control: private, max-age=300`, então a MESMA URL entrega uma cópia
  // de até 5 minutos atrás. Linha apagada na planilha continuava aparecendo.
  const url = `${PUB_BASE}?gid=${gid}&single=true&output=csv&_=${Date.now()}`;
  const text = await fetchCsv(url, 3);
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV vazio ou inválido");
  const { data, datas } = extraiRespostas(rows);
  if (data.length === 0) throw new Error("Nenhuma resposta válida encontrada");
  return {
    name,
    label: name.replace("Formulário NPS - ", ""),
    data,
    mesRef: mesReferencia(name, datas),
  };
}

/**
 * Todas as abas de uma vez, para o Resumo.
 *
 * Uma aba que falhe não derruba o resumo — ela fica de fora e a tela diz quais
 * não vieram. Melhor um resumo com 5 de 6 meses, dizendo isso, do que uma tela
 * de erro.
 */
export async function carregaTodasAbas() {
  const nomes = Object.keys(NPS_SHEETS);
  const abas = await Promise.all(
    nomes.map((n) => carregaAba(n).catch(() => null)),
  );
  const ok = abas.filter((a): a is Aba => a !== null);
  return { abas: ok, faltando: nomes.length - ok.length };
}

/** Promotor dá 9 ou 10, neutro 7 ou 8, detrator o resto. */
export function calc(notas: number[]): Stats {
  const valid = notas.filter((n) => !isNaN(n) && n >= 0 && n <= 10);
  const total = valid.length;
  if (total === 0) return { nps: 0, promotores: 0, neutros: 0, detratores: 0, total: 0 };
  let p = 0, n = 0, d = 0;
  valid.forEach((v) => {
    if (v >= 9) p++;
    else if (v >= 7) n++;
    else d++;
  });
  return {
    nps: Math.round(((p - d) / total) * 100),
    promotores: p,
    neutros: n,
    detratores: d,
    total,
  };
}

/** Faixa dos indicadores gerais (os dois medidores do topo). */
export function badgeGeral(nps: number) {
  if (nps >= 50) return { label: "Excelente", className: "bg-green-100 text-green-700" };
  if (nps >= 0) return { label: "Bom", className: "bg-amber-100 text-amber-700" };
  return { label: "Crítico", className: "bg-red-100 text-red-700" };
}

/** Faixa de cada gestor — mais exigente que a geral, de propósito. */
export function badgeGestor(nps: number) {
  if (nps >= 90) return { label: "Excelência", className: "bg-green-100 text-green-700" };
  if (nps >= 70) return { label: "Muito bom", className: "bg-amber-100 text-amber-700" };
  return { label: "A melhorar", className: "bg-red-100 text-red-700" };
}

/**
 * Cor do número grande no card do gestor. Classe em vez de hex: a paleta é
 * reescrita no tema escuro (ver globals.css), então um valor cravado ficaria
 * fora do tom no escuro.
 */
export function corDoScore(nps: number) {
  return nps >= 80 ? "text-green-500" : nps >= 60 ? "text-yellow-500" : "text-red-500";
}

/** Cor da barra de meta, na mesma lógica de faixas do KPI-HUB. */
export function corDaMeta(respostas: number, alvo: number, pct: number) {
  if (respostas >= alvo) return "bg-green-500";
  return pct >= 60 ? "bg-yellow-500" : "bg-red-500";
}

/** Agrupa por gestor atual e ordena por nome, como na tela do KPI-HUB. */
export function agrupaPorGestor(data: Resposta[]) {
  const by: Record<string, Resposta[]> = {};
  data.forEach((d) => {
    if (!by[d.utmAtual]) by[d.utmAtual] = [];
    by[d.utmAtual].push(d);
  });
  return Object.keys(by)
    .sort((a, b) => (UTM_NAMES[a] || `utm_source ${a}`).localeCompare(UTM_NAMES[b] || `utm_source ${b}`))
    .map((utm) => ({
      utm,
      nome: UTM_NAMES[utm] || `utm_source ${utm}`,
      items: by[utm],
      stats: calc(by[utm].map((d) => d.notaGestor)),
    }));
}
