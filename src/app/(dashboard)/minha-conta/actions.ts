"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const changeSchema = z.object({
  newPassword: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export async function forceChangePasswordAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const parsed = changeSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

  if (error) return { error: "Erro ao atualizar senha. Tente novamente." };

  await prisma.user.update({
    where: { id: user.userId },
    data: { mustChangePassword: false },
  });

  redirect("/dashboard");
}

export async function updateAvatarAction(
  formData: FormData,
): Promise<{ error?: string; avatarUrl?: string }> {
  const user = await requireAuth();

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return { error: "Selecione uma imagem." };
  if (file.size > 3 * 1024 * 1024) return { error: "Imagem deve ter no máximo 3MB." };
  if (!file.type.startsWith("image/")) return { error: "Arquivo deve ser uma imagem." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.userId}.${ext}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Garante que o bucket existe (ignora erro se já existir)
  await supabaseAdmin.storage.createBucket("avatars", { public: true }).catch(() => {});

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { error: "Erro ao fazer upload. Tente novamente." };

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`; // cache bust

  await prisma.user.update({
    where: { id: user.userId },
    data: { avatarUrl: data.publicUrl },
  });

  revalidatePath("/minha-conta");
  revalidatePath("/dashboard");
  return { avatarUrl };
}

export async function removeAvatarAction(): Promise<{ error?: string }> {
  const user = await requireAuth();

  await prisma.user.update({
    where: { id: user.userId },
    data: { avatarUrl: null },
  });

  revalidatePath("/minha-conta");
  revalidatePath("/dashboard");
  return {};
}
