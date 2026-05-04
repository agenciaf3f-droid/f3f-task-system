import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeNextOccurrence, parseRecurrenceRuleFromDb } from "@/lib/recurrence";

// Protege com CRON_SECRET — Vercel envia Authorization: Bearer <secret> em chamadas de cron
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Tarefas recorrentes sem ocorrência futura pendente
  const recurringTasks = await prisma.task.findMany({
    where: {
      recurrenceRule: { not: undefined },
      recurrenceParentId: null,
      deletedAt: null,
      // Não há ocorrência com dueDate >= hoje
      recurrenceOccurrences: {
        none: { dueDate: { gte: today }, deletedAt: null },
      },
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      description: true,
      priority: true,
      assigneeId: true,
      sectorId: true,
      projectId: true,
      createdById: true,
      recurrenceRule: true,
      dueDate: true,
    },
  });

  let created = 0;

  for (const task of recurringTasks) {
    const rule = parseRecurrenceRuleFromDb(task.recurrenceRule);
    if (!rule) continue;

    const baseDate = task.dueDate ?? today;
    const nextDue = computeNextOccurrence(rule, baseDate);

    // Só cria se próxima ocorrência for hoje ou no futuro próximo (evita backfill infinito)
    if (nextDue < today) continue;

    await prisma.task.create({
      data: {
        companyId: task.companyId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        assigneeId: task.assigneeId,
        sectorId: task.sectorId,
        projectId: task.projectId,
        createdById: task.createdById,
        recurrenceRule: task.recurrenceRule ?? undefined,
        recurrenceParentId: task.id,
        dueDate: nextDue,
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}
