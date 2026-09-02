"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SELECT_CLASS =
  "h-9 rounded-full border-0 bg-neutral-100 px-3 text-xs font-medium text-neutral-800 outline-none transition-colors hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-neutral-400";

/**
 * Os dois seletores da tela mexem na URL, não em estado local: assim o mês
 * escolhido sobrevive ao recarregar e pode ser mandado por link para outra
 * pessoa. O resto da página é server component e refaz a busca sozinho.
 */
function useTrocaParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (chave: string, valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(chave, valor);
    else params.delete(chave);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  };
}

export function MonthFilter({
  value,
  options,
  resumoValue,
}: {
  value: string;
  options: string[];
  resumoValue: string;
}) {
  const troca = useTrocaParam();

  return (
    <select
      value={value}
      onChange={(e) => troca("mes", e.target.value)}
      aria-label="Mês da pesquisa"
      className={SELECT_CLASS}
    >
      {/* Resumo primeiro, separado dos meses: é uma visão diferente, não mais um mês. */}
      <option value={resumoValue}>📊 Resumo (todos os meses)</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name.replace("Formulário NPS - ", "")}
        </option>
      ))}
    </select>
  );
}

export function GestorFilter({
  value,
  options,
}: {
  value: string;
  options: { utm: string; nome: string }[];
}) {
  const troca = useTrocaParam();

  return (
    <select
      value={value}
      onChange={(e) => troca("gestor", e.target.value)}
      aria-label="Gestor"
      className={SELECT_CLASS}
    >
      <option value="">Todos os gestores</option>
      {options.map((o) => (
        <option key={o.utm} value={o.utm}>
          {o.nome}
        </option>
      ))}
    </select>
  );
}
