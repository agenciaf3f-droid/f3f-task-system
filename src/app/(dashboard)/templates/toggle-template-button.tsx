"use client";

import { useTransition } from "react";
import { toggleTemplateActiveAction } from "./actions";

export function ToggleTemplateButton({ templateId, isActive }: { templateId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(() => toggleTemplateActiveAction(templateId));
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40"
    >
      {isActive ? "Desativar" : "Ativar"}
    </button>
  );
}
