import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to deploy migrations");
}

const sessionPoolerUrl = databaseUrl.replace(":6543/", ":5432/");

if (sessionPoolerUrl === databaseUrl) {
  throw new Error("DATABASE_URL must use the Supabase transaction pooler on port 6543");
}

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
