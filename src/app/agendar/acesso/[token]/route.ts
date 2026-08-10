import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setClientSession } from "@/lib/client-session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function notFoundResponse() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return notFoundResponse();

  const magicLink = await prisma.bookingMagicLink.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      client: { deletedAt: null },
      manager: { isActive: true, deletedAt: null },
    },
    select: {
      id: true,
      clientEmail: true,
      clientName: true,
      clientPlan: true,
      clientGroupId: true,
      managerId: true,
      manager: {
        select: { calendarSlug: true, calendarToken: true },
      },
    },
  });
  if (!magicLink) return notFoundResponse();

  const hostToken = magicLink.manager.calendarSlug || magicLink.manager.calendarToken;
  if (!hostToken) return notFoundResponse();

  await setClientSession({
    clientEmail: magicLink.clientEmail ?? undefined,
    clientName: magicLink.clientName,
    clientPlan: magicLink.clientPlan ?? undefined,
    clientGroupId: magicLink.clientGroupId,
    clientGestor: magicLink.managerId,
    bookingToken: hostToken,
  });
  await prisma.bookingMagicLink.update({
    where: { id: magicLink.id },
    data: { openedAt: new Date() },
  });

  const response = NextResponse.redirect(new URL(`/agendar/${hostToken}`, request.url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
