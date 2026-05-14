export const config = {
  crons: [
    // Roda às 3h UTC diariamente — cria próximas instâncias de tarefas recorrentes
    { path: "/api/cron/recurrence", schedule: "0 3 * * *" },
    // Sync Google Calendar → Meeting (1x/dia às 4h UTC = 01h BRT)
    // Hobby plan limita a 1x/dia. Pra hora-em-hora, upgrade Pro.
    { path: "/api/cron/sync-calendar", schedule: "0 4 * * *" },
  ],
} as const;
