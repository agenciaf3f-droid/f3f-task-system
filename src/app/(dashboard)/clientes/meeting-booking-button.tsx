"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getClientScheduledMeetingAction, sendClientBookingLinkAction } from "./meeting-actions";

export function MeetingBookingButton({
  clientId,
  disabledReason,
  initialScheduledDate,
}: {
  clientId: string;
  disabledReason?: string;
  initialScheduledDate?: string;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(initialScheduledDate);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (scheduledDate) return;

    const checkStatus = async () => {
      const result = await getClientScheduledMeetingAction(clientId);
      if (result.date) setScheduledDate(result.date);
    };
    const interval = window.setInterval(checkStatus, 15_000);
    return () => window.clearInterval(interval);
  }, [clientId, scheduledDate]);

  function openScheduledMeeting() {
    if (!scheduledDate) return;
    router.push(`/calendario?month=${scheduledDate.slice(0, 7)}&date=${scheduledDate}`);
  }

  function sendBookingLink() {
    startTransition(async () => {
      const result = await sendClientBookingLinkAction(clientId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setSent(true);
      const duration = result.durationMinutes === 60 ? "1 hora" : `${result.durationMinutes} min`;
      const frequency = result.recurrence === "weekly" ? "semanal" : "mensal";
      toast.success(
        result.testMode
          ? `Teste enviado ao grupo autorizado · ${duration}, ${frequency}.`
          : `Link enviado no grupo do WhatsApp · ${duration}, ${frequency}.`,
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={scheduledDate ? openScheduledMeeting : sendBookingLink}
      disabled={!scheduledDate && (isPending || Boolean(disabledReason))}
      title={scheduledDate ? "Abrir reunião no calendário" : disabledReason}
      className={scheduledDate || sent ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : ""}
    >
      {scheduledDate ? (
        <CalendarCheck />
      ) : isPending ? (
        <Loader2 className="animate-spin" />
      ) : sent ? (
        <Check />
      ) : (
        <CalendarPlus />
      )}
      {scheduledDate
        ? "Reunião agendada"
        : disabledReason
        ? "Agendamento indisponível"
        : isPending
        ? "Enviando..."
        : sent
          ? "Enviar novamente"
          : "Agendar reunião"}
    </Button>
  );
}
