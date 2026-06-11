import React from "react";

// Captura http(s)://… e www.… parando antes de pontuação final comum.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;!?)\]}'"])|(www\.[^\s<]+[^\s<.,:;!?)\]}'"])/gi;

/**
 * Transforma URLs em texto plano em <a> clicáveis (abrem em nova aba).
 * Função pura (sem hooks) — funciona em Server e Client Components.
 */
export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, "gi");

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const raw = m[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a
        key={`${m.index}-${raw}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-800 break-all"
      >
        {raw}
      </a>,
    );
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}
