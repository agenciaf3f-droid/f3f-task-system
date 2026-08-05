import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { centralSetPasswordEverywhere } from "@/lib/f3f-central";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TOKEN_HASH = "9f2715b39d4f98d483ff7838e3759cce6e249ed65fba7afad6a19ca183efaa70";
const SOURCE_EMAIL = "gd43381@gmail.com";
const TARGET_EMAIL = "guilherme.paula09@outlook.com";

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

async function findCentralUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers central: ${error.message}`);
    const user = data.users.find((candidate) => normalizeEmail(candidate.email) === email);
    if (user) return user;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || createHash("sha256").update(token).digest("hex") !== TOKEN_HASH) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 16) return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });

  const url = process.env.F3F_CENTRAL_SUPABASE_URL;
  const serviceKey = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Credenciais administrativas do login central ausentes" }, { status: 503 });
  }

  const localUsers = await prisma.user.findMany({
    where: { email: { in: [SOURCE_EMAIL, TARGET_EMAIL] }, isActive: true, deletedAt: null },
    select: { id: true, email: true },
  });
  if (localUsers.length > 1) {
    return NextResponse.json({ error: "Existem duas contas locais; consolidação manual necessária" }, { status: 409 });
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const [source, duplicate] = await Promise.all([
    findCentralUserByEmail(admin, SOURCE_EMAIL),
    findCentralUserByEmail(admin, TARGET_EMAIL),
  ]);
  if (!source || !duplicate || source.id === duplicate.id) {
    return NextResponse.json({ error: "Contas centrais não encontradas para consolidação" }, { status: 404 });
  }

  const { data: logins, error: loginsError } = await admin
    .from("f3f_logins")
    .select("id, auth_user_id, system")
    .in("auth_user_id", [source.id, duplicate.id]);
  if (loginsError) return NextResponse.json({ error: `Acessos centrais: ${loginsError.message}` }, { status: 502 });

  const sourceSystems = new Set(
    (logins ?? []).filter((login) => login.auth_user_id === source.id).map((login) => login.system),
  );
  for (const login of (logins ?? []).filter((item) => item.auth_user_id === duplicate.id)) {
    const { error } = sourceSystems.has(login.system)
      ? await admin.from("f3f_logins").delete().eq("id", login.id)
      : await admin
          .from("f3f_logins")
          .update({ auth_user_id: source.id, email: TARGET_EMAIL })
          .eq("id", login.id);
    if (error) return NextResponse.json({ error: `Migração de acessos: ${error.message}` }, { status: 502 });
  }

  const { error: sourceEmailError } = await admin
    .from("f3f_logins")
    .update({ email: TARGET_EMAIL })
    .eq("auth_user_id", source.id);
  if (sourceEmailError) return NextResponse.json({ error: `Atualização de acessos: ${sourceEmailError.message}` }, { status: 502 });

  const { error: deleteError } = await admin.auth.admin.deleteUser(duplicate.id);
  if (deleteError) return NextResponse.json({ error: `Remoção da conta duplicada: ${deleteError.message}` }, { status: 502 });

  const { error: sourceUpdateError } = await admin.auth.admin.updateUserById(source.id, {
    email: TARGET_EMAIL,
    password,
    user_metadata: { ...source.user_metadata, must_change_password: false },
  });
  if (sourceUpdateError) return NextResponse.json({ error: `Atualização da conta principal: ${sourceUpdateError.message}` }, { status: 502 });

  const passwordSync = await centralSetPasswordEverywhere(TARGET_EMAIL, password);
  if (!passwordSync.ok) return NextResponse.json({ error: passwordSync.warning ?? "Falha ao propagar senha" }, { status: 502 });

  const localUser = localUsers[0];
  if (localUser) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: localUser.id },
        data: {
          email: TARGET_EMAIL,
          passwordHash: await hash(password, 12),
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: localUser.id } }),
    ]);
  }

  return NextResponse.json({ ok: true, email: TARGET_EMAIL });
}
