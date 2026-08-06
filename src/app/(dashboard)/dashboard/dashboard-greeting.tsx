"use client";

import { useEffect, useState } from "react";

const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";

function getHourInSaoPaulo(date: Date) {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).format(date));
}

function getGreeting(date: Date) {
  const hour = getHourInSaoPaulo(date);
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getDateLabel(date: Date) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: DASHBOARD_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardGreeting({ firstName, initialNowIso }: { firstName: string; initialNowIso: string }) {
  const [now, setNow] = useState(() => new Date(initialNowIso));

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
        {getGreeting(now)}, {firstName}
      </h1>
      <p className="text-sm text-neutral-500 mt-1">
        {getDateLabel(now)}
      </p>
    </div>
  );
}
