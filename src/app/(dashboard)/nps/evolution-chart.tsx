"use client";

import { useState } from "react";

/**
 * Evolução do NPS mês a mês.
 *
 * Substitui o gráfico de linha que no KPI-HUB era Chart.js. São duas séries
 * curtas sobre um eixo fixo, então o SVG sai menor que a biblioteca — e o
 * projeto continua sem dependência de gráficos.
 *
 * Um mês sem resposta chega aqui como `null` e vira buraco: a linha pula por
 * cima dele em vez de descer até zero, porque zero seria lido como "NPS
 * péssimo" e não como "não teve resposta".
 */

const W = 800;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 34, left: 42 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// Mesmas cores e opacidades do gráfico do KPI-HUB. As duas séries vivem coladas
// na faixa alta (75-100), então as áreas se sobrepõem quase inteiras e o
// preenchimento aparece como um bloco só — é assim lá também; quem carrega a
// leitura é a linha, a área só dá volume.
const SERIES = [
  { key: "gestor" as const, label: "NPS do Gestor", cor: "#8b5cf6", opacidade: 0.12 },
  { key: "agencia" as const, label: "NPS da Agência", cor: "#0866ff", opacidade: 0.1 },
];

export function EvolutionChart({
  labels,
  gestor,
  agencia,
  totais,
}: {
  labels: string[];
  gestor: (number | null)[];
  agencia: (number | null)[];
  totais: number[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Teto travado em 100 para uma variação pequena não parecer um tombo por
  // causa do autoajuste. O piso começa em 0: o NPS vai até -100, mas as notas
  // daqui nunca chegaram perto disso e metade do gráfico ficava vazia. Se algum
  // mês FOR negativo o piso desce, senão o ponto sumiria.
  const temNegativo = [...gestor, ...agencia].some((v) => v != null && v < 0);
  const yMin = temNegativo ? -100 : 0;
  const yMax = 100;

  const x = (i: number) => (labels.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i * PLOT_W) / (labels.length - 1));
  const y = (v: number) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += 25) ticks.push(v);

  const dados = { gestor, agencia };

  return (
    <div className="w-full overflow-x-auto">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[0.7rem] text-neutral-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-[320px] w-full min-w-[520px]" role="img" aria-label="Evolução do NPS por mês">
        {ticks.map((t) => (
          <g key={t}>
            {/* Grade e linha-guia saem da paleta neutra, que o tema escuro
                reescreve — em cinza fixo elas gritavam sobre o fundo escuro. */}
            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} className="stroke-neutral-200" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-neutral-400 text-[11px]">
              {t}
            </text>
          </g>
        ))}

        {SERIES.map((s) => {
          const serie = dados[s.key];
          // `spanGaps`: só os pontos com valor entram no traçado, e a linha
          // liga os vizinhos por cima do buraco.
          const pts = serie
            .map((v, i) => (v == null ? null : { x: x(i), y: y(v) }))
            .filter((p): p is { x: number; y: number } => p !== null);
          if (!pts.length) return null;
          const linha = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
          const base = PAD.top + PLOT_H;
          const area = `${linha} L ${pts[pts.length - 1].x} ${base} L ${pts[0].x} ${base} Z`;
          return (
            <g key={s.key}>
              <path d={area} fill={s.cor} fillOpacity={s.opacidade} />
              <path d={linha} fill="none" stroke={s.cor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={s.cor} strokeWidth={2} />
              ))}
            </g>
          );
        })}

        {labels.map((label, i) => (
          <text key={label} x={x(i)} y={H - 10} textAnchor="middle" className="fill-neutral-400 text-[11px]">
            {label}
          </text>
        ))}

        {/* Faixa invisível por mês: dá alvo de mouse para a leitura do ponto. */}
        {labels.map((label, i) => (
          <rect
            key={`hit-${label}`}
            x={x(i) - PLOT_W / (labels.length * 2 || 1)}
            y={PAD.top}
            width={PLOT_W / (labels.length || 1)}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {hover !== null && (
          <line x1={x(hover)} y1={PAD.top} x2={x(hover)} y2={PAD.top + PLOT_H} className="stroke-neutral-400" strokeWidth={1} strokeDasharray="4 3" />
        )}
      </svg>

      <div className="mt-2 min-h-[2.5rem] text-center text-[0.72rem] text-neutral-500">
        {hover !== null && (
          <>
            <span className="font-semibold text-neutral-800">{labels[hover]}</span>
            {SERIES.map((s) => {
              const v = dados[s.key][hover];
              return (
                <span key={s.key} className="ml-3">
                  <span style={{ color: s.cor }}>●</span> {s.label}: {v == null ? "sem resposta" : v}
                </span>
              );
            })}
            <span className="ml-3 text-neutral-400">{totais[hover]} respostas no mês</span>
          </>
        )}
      </div>
    </div>
  );
}
