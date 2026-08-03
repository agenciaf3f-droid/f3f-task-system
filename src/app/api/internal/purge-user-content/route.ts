import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const TOKEN_HASH = "3ecd57335cc20f96206a4be6690595a86712cc3bbb49ff96721671caca0c5457";
const ATTACHMENTS_BUCKET = "task-attachments";

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  return createHash("sha256")
    .update(authorization.slice("Bearer ".length))
    .digest("hex") === TOKEN_HASH;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const attachments = await prisma.taskAttachment.findMany({
      select: { fileUrl: true },
    });

    for (const paths of chunk(attachments.map((attachment) => attachment.fileUrl), 100)) {
      const { error } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove(paths);
      if (error) throw error;
    }

    const [tasks, projects, notifications, activityLogs, passwordResetTokens] = await prisma.$transaction([
      prisma.task.deleteMany(),
      prisma.project.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.passwordResetToken.deleteMany(),
    ]);

    return NextResponse.json({
      ok: true,
      deleted: {
        attachments: attachments.length,
        tasks: tasks.count,
        projects: projects.count,
        notifications: notifications.count,
        activityLogs: activityLogs.count,
        passwordResetTokens: passwordResetTokens.count,
      },
    });
  } catch (error) {
    console.error("User content purge failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
