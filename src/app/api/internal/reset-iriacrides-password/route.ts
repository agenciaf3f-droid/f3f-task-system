import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { centralEnabled, centralSetPasswordEverywhere } from "@/lib/f3f-central";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TOKEN_HASH = "3c00a88af4283d1c54a9632ae4bf096dc667669f64fe62f938b4b02665c04379";
const EMAIL = "iriacridesdamiaopinhas@gmail.com";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || createHash("sha256").update(token).digest("hex") !== TOKEN_HASH) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password !== "123456") return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: EMAIL, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Conta local não encontrada" }, { status: 404 });

  if (centralEnabled()) {
    const central = await centralSetPasswordEverywhere(EMAIL, password);
    if (!central.ok) return NextResponse.json({ error: central.warning ?? "Falha no login central" }, { status: 502 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(password, 12), mustChangePassword: false },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
