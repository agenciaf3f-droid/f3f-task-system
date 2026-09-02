"use client";

import { useState } from "react";
import { badgeGestor, corDoScore, type Resposta, type Stats } from "@/lib/nps";

/**
 * Card de um gestor na seção "NPS por Gestor".
 *
 * É client component só por causa dos dois níveis de expandir: a lista de
 * feedbacks do gestor e, dentro de cada resposta, a avaliação da empresa. No
 * KPI-HUB isso era `onclick` inline mexendo em `style.display`; aqui é estado.
 */
export function GestorCard({
  nome,
  items,
  stats,
}: {
  nome: string;
  items: Resposta[];
  stats: Stats;
}) {
  const [aberto, setAberto] = useState(false);
  const badge = badgeGestor(stats.nps);
  const feedbacks = items.filter((d) => d.feedbackGestor && d.feedbackGestor.length > 0);

  // Aviso de cliente herdado. Fica no cabeçalho porque nem todo transferido
  // deixa feedback escrito — se ficasse só na lista, sumiria nesses casos.
  const herdados = items.filter((d) => d.gestorAnterior);
  const deQuem = [...new Set(herdados.map((d) => d.gestorAnterior))].sort();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[0.88rem] font-bold text-neutral-900">{nome}</div>
          <div className="text-[0.7rem] text-neutral-500">
            {stats.total} respostas · {stats.promotores}P / {stats.neutros}N / {stats.detratores}D
          </div>
          {herdados.length > 0 && (
            <div className="mt-1 text-[0.66rem] font-semibold text-indigo-500">
              ↩ {herdados.length === 1 ? "1 cliente veio" : `${herdados.length} clientes vieram`} de{" "}
              {deQuem.join(" e ")}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-2xl font-extrabold tracking-[-0.03em] tabular-nums ${corDoScore(stats.nps)}`}>
            {stats.nps}
          </div>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.67rem] font-bold whitespace-nowrap ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-[0.72rem] text-neutral-400">Sem feedbacks</div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-1.5 text-[0.74rem] font-semibold text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            {aberto ? "Ocultar" : "Ver"} feedbacks ({feedbacks.length})
          </button>
          {aberto && (
            <div className="mt-3 flex flex-col gap-2">
              {feedbacks.map((f, i) => (
                <Feedback key={i} resposta={f} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Feedback({ resposta }: { resposta: Resposta }) {
  const [verAgencia, setVerAgencia] = useState(false);
  const temNota = !isNaN(resposta.notaAgencia);
  const temTexto = resposta.feedbackAgencia.length > 0;

  return (
    <div className="rounded-[10px] border border-neutral-100 bg-neutral-50 px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-neutral-900">
      <div className="mb-0.5 text-[0.68rem] font-bold text-neutral-600">
        Nota: {resposta.notaGestor}
        {resposta.gestorAnterior && (
          <span
            title={`Cliente transferido: antes era do ${resposta.gestorAnterior}`}
            className="ml-1.5 inline-block rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-px align-middle text-[0.62rem] font-semibold text-indigo-600"
          >
            ↩ antes: {resposta.gestorAnterior}
          </span>
        )}
      </div>
      {resposta.feedbackGestor}

      {/* Cada resposta guarda também a avaliação da agência. Fica atrás de um
          expandir por resposta para não competir com o texto do gestor. */}
      {(temNota || temTexto) && (
        <>
          <button
            type="button"
            onClick={() => setVerAgencia((v) => !v)}
            aria-expanded={verAgencia}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-0.5 text-[0.66rem] font-semibold text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
          >
            {verAgencia ? "▾" : "▸"} Avaliação da empresa
          </button>
          {verAgencia && (
            <div className="mt-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[0.75rem] leading-relaxed text-neutral-900">
              <div className="mb-0.5 text-[0.66rem] font-bold text-neutral-500">
                Nota para a empresa: {temNota ? resposta.notaAgencia : "—"}
              </div>
              {temTexto ? (
                resposta.feedbackAgencia
              ) : (
                <span className="text-neutral-400 italic">Não escreveu nada para a empresa.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
