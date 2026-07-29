"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { centralEnabled, centralSetPasswordEverywhere } from "@/lib/f3f-central";

export async function forceChangePasswordAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 6) return { error: "Mínimo 6 caracteres." };
  if (newPassword !== confirmPassword) return { error: "As senhas não coincidem." };

  const passwordHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash, mustChangePassword: false },
  });

  // Propaga para o login central F3F (senha única entre os sistemas).
  // Hash local acima é mantido só como fallback enquanto o central não é a única fonte.
  if (centralEnabled()) {
    const sync = await centralSetPasswordEverywhere(user.email, newPassword);
    if (!sync.ok || sync.warning) {
      console.error("[minha-conta/senha] sync central:", sync.warning);
    }
  }

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

  await supabaseAdmin.storage.createBucket("avatars", { public: true }).catch(() => {});

  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { error: "Erro ao fazer upload. Tente novamente." };

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

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
