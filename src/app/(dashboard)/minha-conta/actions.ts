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

  // Central PRIMEIRO: com o central habilitado, o login valida lá — gravar só
  // localmente e falhar no central deixaria a pessoa trancada pra fora
  // (senha nova local, senha velha no central). Central falhou → nada muda.
  if (centralEnabled()) {
    const sync = await centralSetPasswordEverywhere(user.email, newPassword);
    if (!sync.ok) {
      console.error("[minha-conta/senha] sync central:", sync.warning);
      return { error: "Não foi possível salvar a senha agora. Tente de novo em instantes." };
    }
    if (sync.warning) console.error("[minha-conta/senha] sync central:", sync.warning);
  }

  const passwordHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash, mustChangePassword: false },
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
  const extensionsByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extensionsByType[file.type];
  if (!ext) return { error: "A imagem deve ser JPG, PNG ou WebP." };

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
