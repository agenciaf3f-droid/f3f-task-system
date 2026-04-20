import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ tasks: [] });

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      title: { contains: q, mode: "insensitive" },
    },
    select: { id: true, title: true, status: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
}
