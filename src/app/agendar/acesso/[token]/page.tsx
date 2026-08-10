import { createHash } from "crypto";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setClientSession } from "@/lib/client-session";

export const metadata = {
  title: "Acessar agendamento",
  robots: { index: false, follow: false },
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export default async function MagicBookingAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

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
  if (!magicLink) notFound();

  const hostToken = magicLink.manager.calendarSlug || magicLink.manager.calendarToken;
  if (!hostToken) notFound();

  await Promise.all([
    prisma.bookingMagicLink.update({
      where: { id: magicLink.id },
      data: { openedAt: new Date() },
    }),
    setClientSession({
      clientEmail: magicLink.clientEmail,
      clientName: magicLink.clientName,
      clientPlan: magicLink.clientPlan ?? undefined,
      clientGroupId: magicLink.clientGroupId,
      clientGestor: magicLink.managerId,
      bookingToken: hostToken,
    }),
  ]);

  redirect(`/agendar/${hostToken}`);
}
