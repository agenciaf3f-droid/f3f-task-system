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
  internalHostId,
}: {
  users: Option[];
  clients: Option[];
  currentUserId: string;
  canManageAll: boolean;
  defaultDate: string;
  internalHostId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hostId, setHostId] = useState(currentUserId);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [isAllDay, setIsAllDay] = useState(false);
  const isInternalMeeting = hostId === internalHostId;

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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
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

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Responsável
              <select
                name="hostId"
                value={hostId}
                onChange={(event) => setHostId(event.target.value)}
                disabled={!canManageAll}
                className="h-10 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              >
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              {!canManageAll ? <input type="hidden" name="hostId" value={currentUserId} /> : null}
            </label>

            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Cliente (opcional)
              <select
                name="clientId"
                defaultValue=""
                className="h-10 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Sem cliente</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-900">Outros responsáveis ou convidados internos</legend>
            <p className="text-xs text-slate-600">
              As pessoas marcadas verão a reunião em “Minhas”, poderão gerenciá-la e receberão o convite do Google Calendar.
            </p>
            {isInternalMeeting && canManageAll ? (
              <p className="text-xs text-sky-700">
                Em reuniões do Admin F3F, sem ninguém marcado o evento continua visível para toda a equipe.
              </p>
            ) : null}
            <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {users.filter((person) => person.id !== hostId).map((person) => (
                <label key={person.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm font-normal text-slate-700 hover:bg-white">
                  <input type="checkbox" name="participantUserIds" value={person.id} />
                  {person.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Convidados externos (opcional)
            <textarea
              name="guestEmails"
              rows={2}
              placeholder="email@empresa.com, outro@empresa.com"
              className="min-h-20 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="text-xs font-normal text-slate-500">Separe os e-mails por vírgula, espaço ou ponto e vírgula.</span>
          </label>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Data de início
              <input
                type="date"
                name="startDate"
                required
                min={defaultDate}
                value={startDate}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartDate(nextStart);
                  if (endDate < nextStart) setEndDate(nextStart);
                }}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Data de término
              <input
                type="date"
                name="endDate"
                required
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="isAllDay"
              checked={isAllDay}
              onChange={(event) => setIsAllDay(event.target.checked)}
            />
            Dia inteiro
          </label>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Horário de início
              <input
                type="time"
                name="startTime"
                required={!isAllDay}
                disabled={isAllDay}
                defaultValue="09:00"
                className="h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Horário de término
              <input
                type="time"
                name="endTime"
                required={!isAllDay}
                disabled={isAllDay}
                defaultValue="09:30"
                className="h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
