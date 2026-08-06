"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";

interface MemberFilterProps {
  members: { id: string; name: string }[];
  selected: string; // "" = eu mesmo · "all" = todos · senão = id do membro
  view: string;
}

// Exceção de visibilidade: cargos elevados podem trocar de "minhas tarefas"
// pra ver/filtrar as tarefas de qualquer membro da empresa (server valida).
export function MemberFilter({ members, selected, view }: MemberFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    params.set("view", view);
    if (value) params.set("member", value);
    else params.delete("member");

    // A mudança do search param já invalida e renderiza novamente o Server
    // Component. Um router.refresh() imediatamente após push/replace cria uma
    // corrida e pode reaplicar os dados do membro anterior.
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-1.5 border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
      <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      <select
        value={selected}
        onChange={onChange}
        disabled={isPending}
        aria-label="Ver tarefas de"
        className="text-xs text-neutral-700 bg-transparent outline-none cursor-pointer max-w-[140px] disabled:cursor-wait disabled:opacity-60"
      >
        <option value="">Eu mesmo</option>
        <option value="all">Todos</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}
