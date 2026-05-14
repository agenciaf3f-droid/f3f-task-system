"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookingForm } from "./booking-form";
import { MyMeetings, type ClientMeeting } from "./my-meetings";
import type { Recurrence } from "@/lib/meeting-duration";

export function AgendarClient({
  userName,
  token,
  availableDays,
  clientName,
  durationMinutes,
  recurrence,
  upcomingMeetings,
}: {
  userName: string;
  token: string;
  availableDays: number[];
  clientName?: string;
  durationMinutes: number;
  recurrence: Recurrence;
  upcomingMeetings: ClientMeeting[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"list" | "book">(
    upcomingMeetings.length > 0 ? "list" : "book",
  );

  const durationLabel = durationMinutes >= 60
    ? `${Math.floor(durationMinutes / 60)} h${durationMinutes % 60 ? ` ${durationMinutes % 60} min` : ""}`
    : `${durationMinutes} min`;

  if (mode === "list") {
    return (
      <MyMeetings
        meetings={upcomingMeetings}
        token={token}
        availableDays={availableDays}
        durationLabel={durationLabel}
        onChangeAll={() => {
          setMode("book");
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <p className="text-xs text-slate-400 text-center mb-4">Selecione um dia e horário disponível</p>
      <BookingForm
        userName={userName}
        token={token}
        availableDays={availableDays}
        clientName={clientName}
        durationMinutes={durationMinutes}
        recurrence={recurrence}
      />
    </>
  );
}
