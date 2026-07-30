// TEMPORÁRIO — migração única dos usuários do Tasks pro login central F3F.
// Existe porque DATABASE_URL é env sensível na Vercel (ilegível fora do runtime);
// rodar aqui dentro evita a connection string sair da Vercel.
// Proteção: header x-migrate-key precisa bater com F3F_CENTRAL_SERVICE_ROLE_KEY.
// REMOVER esta rota depois do cutover (commit de remoção já planejado).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function POST(request: Request) {
  const url = process.env.F3F_CENTRAL_SUPABASE_URL;
  const key = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "F3F_CENTRAL_* não configuradas" }, { status: 500 });
  }
  if (request.headers.get("x-migrate-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun !== false; // default: dry-run

  const central = createClient(url, key, { auth: { persistSession: false } });

  const centralByEmail = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await central.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: `listUsers: ${error.message}` }, { status: 502 });
    for (const u of data.users) if (u.email) centralByEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  const report: Array<{ email: string; action: string; error?: string }> = [];
  for (const u of users) {
    const email = u.email.toLowerCase();
    let centralId = centralByEmail.get(email);

    if (!centralId) {
      if (dryRun) {
        report.push({ email, action: "criaria (hash importado, senha preservada)" });
        continue;
      }
      const { data, error } = await central.auth.admin.createUser({
        email,
        password_hash: u.passwordHash,
        email_confirm: true,
        user_metadata: { name: u.name },
      });
      if (error || !data.user) {
        report.push({ email, action: "ERRO createUser", error: error?.message });
        continue;
      }
      centralId = data.user.id;
      report.push({ email, action: "criado (senha preservada)" });
    } else {
      report.push({ email, action: "já existia (senha do central prevalece)" });
    }

    if (!dryRun && centralId) {
      const { error } = await central.from("f3f_logins").upsert(
        { auth_user_id: centralId, email, system: "task", external_user_id: u.id, active: true },
        { onConflict: "email,system" },
      );
      if (error) report.push({ email, action: "ERRO f3f_logins", error: error.message });
    }
  }

  return NextResponse.json({ dryRun, totalTaskUsers: users.length, report });
}
