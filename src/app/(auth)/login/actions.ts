"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message;
    return { error: firstError ?? "Dados inválidos." };
  }

  const result = await loginUser(parsed.data.email, parsed.data.password);
  if (result.error) return { error: result.error };

  redirect("/dashboard");
}
