"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateManualMeetingAction } from "./actions";

type Option = { id: string; name: string };

export type EditableMeeting = {
  id: string;
  title: string;
  clientId: string;
  hostId: string;
  participantIds: string[];
  guestEmails: string[];
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  isRecurring: boolean;
};

export function EditMeetingDialog({
  meeting,
  users,
  clients,
  currentUserId,
  canManageAll,
  internalHostId,
  onClose,
}: {
  meeting: EditableMeeting;
  users: Option[];
  clients: Option[];
  currentUserId: string;
  canManageAll: boolean;
  internalHostId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hostId, setHostId] = useState(meeting.hostId);
  const [startDate, setStartDate] = useState(meeting.date);
  const [endDate, setEndDate] = useState(meeting.endDate);
  const [isAllDay, setIsAllDay] = useState(meeting.isAllDay);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateManualMeetingAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
      if (result.warning) window.alert(result.warning);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-600" />
            Editar reunião
          </DialogTitle>
          <DialogDescription>
            As alterações serão aplicadas no Task e no Google Calendar.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="mt-2 grid gap-4">
          <input type="hidden" name="meetingId" value={meeting.id} />

          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Título
            <input
              name="title"
              required
              maxLength={255}
              defaultValue={meeting.title}
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
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-50"
              >
                {users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              {!canManageAll ? <input type="hidden" name="hostId" value={currentUserId} /> : null}
            </label>

            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Cliente (opcional)
              <select
                name="clientId"
                defaultValue={meeting.clientId}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
              >
                <option value="">Sem cliente</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <legend className="px-1 text-sm font-semibold text-slate-900">Outros responsáveis ou convidados internos</legend>
            {hostId === internalHostId ? (
              <p className="text-xs text-sky-700">Reuniões do Admin F3F continuam visíveis para toda a equipe.</p>
            ) : null}
            <div className="grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {users.filter((person) => person.id !== hostId).map((person) => (
                <label key={person.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm font-normal text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    name="participantUserIds"
                    value={person.id}
                    defaultChecked={meeting.participantIds.includes(person.id)}
                  />
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
              defaultValue={meeting.guestEmails.join(", ")}
              placeholder="email@empresa.com, outro@empresa.com"
              className="min-h-20 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
            />
          </label>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Data de início
              <input
                type="date"
                name="startDate"
                required
                value={startDate}
                onChange={(event) => {
                  const nextStart = event.target.value;
                  setStartDate(nextStart);
                  if (endDate < nextStart) setEndDate(nextStart);
                }}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
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
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
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

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Horário de início
              <input
                type="time"
                name="startTime"
                required={!isAllDay}
                disabled={isAllDay}
                defaultValue={meeting.startTime}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Horário de término
              <input
                type="time"
                name="endTime"
                required={!isAllDay}
                disabled={isAllDay}
                defaultValue={meeting.endTime}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100"
              />
            </label>
          </div>

          {meeting.isRecurring ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              A edição altera apenas esta ocorrência da reunião recorrente.
            </p>
          ) : null}
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            É permitido manter reuniões sobrepostas no mesmo período.
          </p>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {pending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
