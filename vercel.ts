export const config = {
  crons: [
    // Roda às 3h UTC diariamente — cria próximas instâncias de tarefas recorrentes
    { path: "/api/cron/recurrence", schedule: "0 3 * * *" },
    // Sync Google Calendar → Meeting a cada hora
    { path: "/api/cron/sync-calendar", schedule: "0 * * * *" },
  ],
} as const;
