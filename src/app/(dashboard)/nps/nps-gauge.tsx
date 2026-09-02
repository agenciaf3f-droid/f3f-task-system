/**
 * Medidor de NPS — meia-lua com ponteiro.
 *
 * No KPI-HUB isto era desenhado num <canvas> pelo Chart.js. Aqui é SVG puro:
 * a figura é estática (três arcos e um ponteiro), então não vale trazer uma
 * biblioteca de gráficos só por causa dela — e em SVG o desenho já sai pronto
 * do servidor, sem esperar JavaScript para aparecer.
 *
 * Geometria igual à do original: faixas 0-60 vermelha, 60-80 amarela e 80-100
 * verde, com o ponteiro mapeando 0..100 sobre a meia-lua.
 */

const W = 200;
const H = 110;
const CX = W / 2;
const CY = H - 8;
const R = Math.min(CX - 10, CY - 10);
const LINE = 18;

/** Ponto sobre a meia-lua. O ângulo começa em π (esquerda) e vai até 2π (direita). */
function ponto(anguloFracao: number, raio: number) {
  const ang = Math.PI + anguloFracao * Math.PI;
  return { x: CX + Math.cos(ang) * raio, y: CY + Math.sin(ang) * raio };
}

function arco(de: number, ate: number) {
  const a = ponto(de, R);
  const b = ponto(ate, R);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

const FAIXAS = [
  { de: 0, ate: 0.6, cor: "#ef4444" },
  { de: 0.6, ate: 0.8, cor: "#eab308" },
  { de: 0.8, ate: 1, cor: "#22c55e" },
];

export function NpsGauge({ valor }: { valor: number }) {
  // O NPS vai de -100 a 100, mas a meia-lua mostra só 0..100: abaixo disso o
  // ponteiro fica encostado à esquerda, no vermelho, que é a leitura certa.
  const t = Math.max(0, Math.min(1, valor / 100));
  const ponta = ponto(t, R - LINE / 2 - 6);

  return (
    <div className="relative mx-auto my-4 h-[110px] w-[200px]">
      {/* O ponteiro herda a cor do texto em vez de um cinza fixo: no tema
          escuro um `#111827` cravado desaparecia sobre o fundo do card. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full text-neutral-900"
        role="img"
        aria-label={`NPS ${valor} de 100`}
      >
        {FAIXAS.map((f) => (
          <path
            key={f.cor}
            d={arco(f.de, f.ate)}
            fill="none"
            stroke={f.cor}
            strokeWidth={LINE}
          />
        ))}
        <line
          x1={CX}
          y1={CY}
          x2={ponta.x}
          y2={ponta.y}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill="currentColor" />
      </svg>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[2.2rem] font-extrabold tracking-[-0.04em] text-neutral-900 tabular-nums">
        {valor}
      </div>
    </div>
  );
}
