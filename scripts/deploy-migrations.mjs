import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to deploy migrations");
}

const sessionPoolerUrl = databaseUrl.replace(":6543/", ":5432/");

if (sessionPoolerUrl === databaseUrl) {
  throw new Error("DATABASE_URL must use the Supabase transaction pooler on port 6543");
}

// One-time recovery for a legacy migration that was applied manually but left
// a failed Prisma history entry. A non-zero status means there is nothing to
// roll back; migrate deploy below remains the source of truth.
spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    "20260507130000_add_meeting_recurrence",
  ],
  {
    env: {
      ...process.env,
      DIRECT_URL: sessionPoolerUrl,
    },
    stdio: "inherit",
  },
);

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    DIRECT_URL: sessionPoolerUrl,
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
