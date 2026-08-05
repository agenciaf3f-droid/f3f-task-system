import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { centralEnabled, centralSetPasswordEverywhere } from "@/lib/f3f-central";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TOKEN_HASH = "8bf0a9ff8149ccb68878882c6ebedea8b3ed8dd5bb2e99107709a8add81b966c";

const ALLOWED_UPDATES = new Map([
  ["gd43381@gmail.com", "guilherme.paula09@outlook.com"],
  ["gabrielmazon1999@gmail.com", "gabrielmazon1999@gmail.com"],
]);

type CredentialsUpdate = {
  currentEmail?: unknown;
  newEmail?: unknown;
  password?: unknown;
};

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function findCentralUserByEmail(
  admin: SupabaseClient,
  email: string,
) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers central: ${error.message}`);
    const user = data.users.find((candidate) => normalizedEmail(candidate.email) === email);
    if (user) return user;
    if (data.users.length < 200) break;
  }
  return null;
}

async function updateCentralCredentials(currentEmail: string, newEmail: string, password: string) {
  if (!centralEnabled()) return { ok: true };

  const url = process.env.F3F_CENTRAL_SUPABASE_URL;
  const serviceKey = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { ok: false, error: "credenciais administrativas do login central ausentes" };

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const centralUser = await findCentralUserByEmail(admin, currentEmail);
  if (!centralUser) return { ok: false, error: "conta não encontrada no login central" };

  const { error: userError } = await admin.auth.admin.updateUserById(centralUser.id, {
    email: newEmail,
    password,
    user_metadata: { ...centralUser.user_metadata, must_change_password: false },
  });
  if (userError) return { ok: false, error: `login central: ${userError.message}` };

  if (currentEmail !== newEmail) {
    const { error: loginError } = await admin
      .from("f3f_logins")
      .update({ email: newEmail })
      .eq("email", currentEmail)
      .eq("system", "task");
    if (loginError) return { ok: false, error: `acesso central: ${loginError.message}` };
  }

  const passwordSync = await centralSetPasswordEverywhere(newEmail, password);
  if (!passwordSync.ok) return { ok: false, error: passwordSync.warning ?? "falha ao propagar senha" };
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (!token || tokenHash !== TOKEN_HASH) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { updates?: CredentialsUpdate[] } | null;
  const updates = body?.updates;
  if (!Array.isArray(updates) || updates.length !== 2) {
    return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });
  }

  const received = new Set<string>();
  const prepared: Array<{ currentEmail: string; newEmail: string; password: string }> = [];
  for (const update of updates) {
    const currentEmail = normalizedEmail(update.currentEmail);
    const newEmail = normalizedEmail(update.newEmail);
    const password = typeof update.password === "string" ? update.password : "";
    if (
      !ALLOWED_UPDATES.has(currentEmail) ||
      ALLOWED_UPDATES.get(currentEmail) !== newEmail ||
      password.length < 16 ||
      received.has(currentEmail)
    ) {
      return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });
    }
    received.add(currentEmail);
    prepared.push({ currentEmail, newEmail, password });
  }
  if (received.size !== ALLOWED_UPDATES.size) {
    return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });
  }

  for (const update of prepared) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: update.currentEmail }, { email: update.newEmail }],
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user) continue;

    const duplicate = await prisma.user.findFirst({
      where: { email: update.newEmail, id: { not: user.id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: "Novo email já está em uso" }, { status: 409 });
  }

  for (const update of prepared) {
    const central = await updateCentralCredentials(update.currentEmail, update.newEmail, update.password);
    if (!central.ok) return NextResponse.json({ error: central.error }, { status: 502 });

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: update.currentEmail }, { email: update.newEmail }],
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!user) continue;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          email: update.newEmail,
          passwordHash: await hash(update.password, 12),
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  return NextResponse.json({ ok: true, updated: prepared.map(({ newEmail }) => ({ email: newEmail })) });
}
