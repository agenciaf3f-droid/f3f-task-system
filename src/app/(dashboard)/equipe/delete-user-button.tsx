"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2, AlertCircle, X } from "lucide-react";
import { deleteUserAction } from "./actions";

export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAction(userId);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Excluir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !isPending && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-sm p-6 flex flex-col gap-4">
            <button
              onClick={() => !isPending && setOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700"
              disabled={isPending}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-neutral-900">Excluir membro</h2>
              <p className="text-sm text-neutral-500">
                Tem certeza que deseja excluir <strong>{userName}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir membro"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
