"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type ForgotState = { error?: string; success?: boolean };

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "E-mail obrigatório." };

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
  });

  // Responde sucesso mesmo se email não existir (evitar enumeração)
  if (!user) return { success: true };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/redefinir-senha/reset`,
  });

  return { success: true };
}
