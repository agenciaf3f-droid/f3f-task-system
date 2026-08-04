import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centralEnabled, centralSetPasswordEverywhere } from "@/lib/f3f-central";

export const runtime = "nodejs";

const TOKEN_HASH = "5eb4bda41e6c596a37e2bc414a80059773dca72d8a364549dfecc72be9937dde";

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  return createHash("sha256")
    .update(authorization.slice("Bearer ".length))
    .digest("hex") === TOKEN_HASH;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || password.length < 8) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (centralEnabled()) {
      const sync = await centralSetPasswordEverywhere(user.email, password);
      if (!sync.ok) {
        console.error("Central password reset failed", sync.warning);
        return NextResponse.json({ error: "Central password reset failed" }, { status: 502 });
      }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(password, 10), mustChangePassword: false },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account password reset failed", error);
    return NextResponse.json({ error: "Password reset failed" }, { status: 500 });
  }
}
