"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { revalidatePath } from "next/cache";

const BUCKET = "task-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "image/jpeg","image/png","image/gif","image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain","text/csv",
  "application/zip",
]);

export async function uploadAttachmentAction(
  taskId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido." };
  if (file.size > MAX_SIZE) return { error: "Arquivo muito grande (máx 10 MB)." };
  if (!ALLOWED_MIME.has(file.type)) return { error: "Tipo de arquivo não permitido." };

  const ext = file.name.split(".").pop() ?? "";
  const storagePath = `${user.companyId}/${taskId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) {
    console.error("[upload] Supabase storage error:", uploadError);
    return { error: `Erro ao fazer upload: ${uploadError.message}` };
  }

  await prisma.taskAttachment.create({
    data: {
      taskId,
      userId: user.userId,
      fileName: file.name,
      fileUrl: storagePath,
      fileSize: file.size,
      mimeType: file.type,
    },
  });

  revalidatePath(`/tarefas/${taskId}`);
  return {};
}

export async function deleteAttachmentAction(
  attachmentId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, task: taskVisibilityFilter(user) },
    select: { fileUrl: true, taskId: true },
  });
  if (!attachment) return { error: "Anexo não encontrado." };

  await supabaseAdmin.storage.from(BUCKET).remove([attachment.fileUrl]);
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/tarefas/${attachment.taskId}`);
  return {};
}

export async function getAttachmentSignedUrlAction(
  attachmentId: string,
): Promise<{ url?: string; error?: string }> {
  const user = await requireAuth();

  const attachment = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, task: taskVisibilityFilter(user) },
    select: { fileUrl: true },
  });
  if (!attachment) return { error: "Anexo não encontrado." };

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(attachment.fileUrl, 60); // 60s

  if (error || !data) {
    console.error("[download] signed URL error:", error);
    return { error: `Erro ao gerar link: ${error?.message ?? "desconhecido"}` };
  }
  return { url: data.signedUrl };
}
