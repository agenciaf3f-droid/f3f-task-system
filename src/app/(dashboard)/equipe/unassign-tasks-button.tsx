"use client";

import { useState, useTransition } from "react";
import { UserMinus, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import { unassignAllTasksAction } from "./actions";

export function UnassignTasksButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await unassignAllTasksAction(userId);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(result.count ?? 0);
      }
    });
  }

  function close() {
    setOpen(false);
    setError(null);
    setDone(null);
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setDone(null); setOpen(true); }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        title="Desatribuir todas as tarefas deste membro"
      >
        <UserMinus className="w-3.5 h-3.5" />
        Desatribuir tarefas
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => !isPending && close()} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-sm p-6 flex flex-col gap-4">
            <button
              onClick={() => !isPending && close()}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700"
              disabled={isPending}
            >
              <X className="w-4 h-4" />
            </button>

            {done !== null ? (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Feito
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {done} tarefa{done !== 1 ? "s" : ""} de <strong>{userName}</strong> {done !== 1 ? "ficaram" : "ficou"} sem responsável. As tarefas continuam existindo — só sem assignee.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={close}
                    className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-neutral-900">Desatribuir tarefas</h2>
                  <p className="text-sm text-neutral-500">
                    Remove <strong>{userName}</strong> como responsável de todas as tarefas dele(a) (principal e multi-atribuição). As tarefas continuam existindo, apenas ficam sem responsável.
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
                    onClick={close}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Desatribuindo...
                      </>
                    ) : (
                      "Desatribuir tarefas"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
