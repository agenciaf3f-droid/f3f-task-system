"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export type ResetState = { error?: string };

export async function resetPasswordAction(
  _token: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) return { error: "Link expirado. Solicite um novo link de redefinição." };

  // Clear mustChangePassword flag if set
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    await prisma.user.updateMany({
      where: { email: user.email },
      data: { mustChangePassword: false },
    });
  }

  redirect("/login");
}
