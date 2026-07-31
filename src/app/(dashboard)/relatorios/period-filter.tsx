"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "month", label: "Este mês" },
];

export function ReportPeriodFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", event.target.value);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={onChange}
      aria-label="Período do relatório"
      className="h-9 rounded-full border-0 bg-neutral-100 px-3 text-xs font-medium text-neutral-800 outline-none transition-colors hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-neutral-400"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
