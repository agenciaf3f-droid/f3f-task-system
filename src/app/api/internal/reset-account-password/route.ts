import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { centralEnabled, centralSetPasswordEverywhere } from "@/lib/f3f-central";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const resetTokenHash = "7fc638483b8de810b023d3e346d0eeb2ff349607f6bf893d7ae8f631b13d2ff0";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (createHash("sha256").update(token).digest("hex") !== resetTokenHash) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { email, password } = await request.json();
  if (typeof email !== "string" || typeof password !== "string" || password.length < 12) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim(), isActive: true, deletedAt: null },
    select: { id: true, email: true },
  });

  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  if (centralEnabled()) {
    const centralResult = await centralSetPasswordEverywhere(user.email, password);
    if (!centralResult.ok) {
      return NextResponse.json({ error: "Falha ao atualizar a conta central" }, { status: 502 });
    }
  }

  const passwordHash = await hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
