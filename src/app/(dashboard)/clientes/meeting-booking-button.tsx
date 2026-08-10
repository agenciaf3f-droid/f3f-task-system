"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendClientBookingLinkAction } from "./meeting-actions";

export function MeetingBookingButton({ clientId, testMode = false }: { clientId: string; testMode?: boolean }) {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

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
      onClick={sendBookingLink}
      disabled={isPending}
      className={sent ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : ""}
    >
      {isPending ? (
        <Loader2 className="animate-spin" />
      ) : sent ? (
        <Check />
      ) : (
        <CalendarPlus />
      )}
      {isPending
        ? "Enviando..."
        : sent
          ? "Enviar novamente"
          : testMode
            ? "Testar agendamento"
            : "Agendar reunião"}
    </Button>
  );
}
