"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createManualMeetingAction } from "./actions";

type Option = { id: string; name: string };

export function NewMeetingDialog({
  users,
  clients,
  currentUserId,
  canManageAll,
  defaultDate,
}: {
  users: Option[];
  clients: Option[];
  currentUserId: string;
  canManageAll: boolean;
  defaultDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createManualMeetingAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger
        render={<button type="button" />}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <CalendarPlus className="h-4 w-4" />
        Nova reunião
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar reunião</DialogTitle>
          <DialogDescription>
            Cadastre diretamente no calendário, sem enviar um link para o cliente.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="mt-2 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Título <span className="sr-only">obrigatório</span>
            <input
              name="title"
              required
              maxLength={255}
              placeholder="Ex.: Reunião de alinhamento"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Responsável
              <select
                name="hostId"
                defaultValue={currentUserId}
                disabled={!canManageAll}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              >
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              {!canManageAll ? <input type="hidden" name="hostId" value={currentUserId} /> : null}
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Cliente (opcional)
              <select
                name="clientId"
                defaultValue=""
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Sem cliente</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Data
            <input
              type="date"
              name="date"
              required
              min={defaultDate}
              defaultValue={defaultDate}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Início
              <input
                type="time"
                name="startTime"
                required
                defaultValue="09:00"
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Término
              <input
                type="time"
                name="endTime"
                required
                defaultValue="09:30"
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {pending ? "Salvando..." : "Adicionar reunião"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
