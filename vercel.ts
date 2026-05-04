export const config = {
  crons: [
    // Roda às 3h UTC diariamente — cria próximas instâncias de tarefas recorrentes
    { path: "/api/cron/recurrence", schedule: "0 3 * * *" },
  ],
} as const;
