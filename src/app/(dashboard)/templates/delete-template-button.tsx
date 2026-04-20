"use client";

import { useTransition, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTemplateAction } from "./actions";

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteTemplateAction(templateId);
      setShowConfirm(false);
    });
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-semibold">Tem certeza?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors disabled:opacity-40 font-semibold"
        >
          Deletar
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="text-xs px-2 py-1 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-xs text-neutral-400 hover:text-red-600 transition-colors flex items-center gap-1"
      aria-label={`Deletar template ${templateName}`}
    >
      <Trash2 className="w-3 h-3" />
      Deletar
    </button>
  );
}
