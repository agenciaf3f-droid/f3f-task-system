import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeNextOccurrence, parseRecurrenceRuleFromDb } from "@/lib/recurrence";
import { generateDueNotifications } from "@/lib/notifications";

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

  const payload: Prisma.TaskCreateManyInput[] = [];

  for (const task of recurringTasks) {
    const rule = parseRecurrenceRuleFromDb(task.recurrenceRule);
    if (!rule) continue;

    const baseDate = task.dueDate ?? today;
    const nextDue = computeNextOccurrence(rule, baseDate);

    // Só cria se próxima ocorrência for hoje ou no futuro próximo (evita backfill infinito)
    if (nextDue < today) continue;

    payload.push({
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
    });
  }

  if (payload.length > 0) {
    await prisma.task.createMany({ data: payload });
  }
  const created = payload.length;

  // ─── Limpeza: séries DIÁRIAS mantêm só as N ocorrências mais recentes ──
  // Agrupa por (title, project_id) porque a cadeia recurrence_parent_id é linked-list
  // (cada nova aponta pra anterior, não pra um root comum), então não dá pra confiar
  // na hierarquia de pai.
  const DAILY_KEEP = 4;
  const purgeResult = await prisma.$executeRaw`
    WITH daily_tasks AS (
      SELECT id, title, project_id, due_date
      FROM tasks
      WHERE deleted_at IS NULL
        AND recurrence_rule->>'freq' = 'daily'
    ),
    ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY title, project_id
               ORDER BY due_date DESC NULLS LAST
             ) AS rn
      FROM daily_tasks
    )
    UPDATE tasks
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id IN (SELECT id FROM ranked WHERE rn > ${DAILY_KEEP})
      AND deleted_at IS NULL
  `;

  // Notificações de vencimento/atraso (dedup interno)
  const dueNotifs = await generateDueNotifications();

  return NextResponse.json({ ok: true, created, purged: Number(purgeResult), dueNotifs });
}
