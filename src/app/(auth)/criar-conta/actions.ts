"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser } from "@/lib/auth";
import { centralCreateTaskUser, centralEnabled } from "@/lib/f3f-central";
import { prisma } from "@/lib/prisma";

const createAccountSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome."),
    email: z.string().trim().email("E-mail inválido."),
    password: z.string().min(10, "A senha deve ter pelo menos 10 caracteres."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "As senhas não coincidem.",
    path: ["passwordConfirmation"],
  });

export type CreateAccountState = { error?: string };

export async function createAccountAction(
  _previousState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const parsed = createAccountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "Já existe uma conta com este e-mail. Faça login para continuar." };

  // O cadastro público só é seguro quando há uma única organização ativa.
  // Em instalações multiempresa, a inclusão deve ocorrer pelo convite do admin.
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true },
    take: 2,
  });
  if (companies.length !== 1) {
    return { error: "O cadastro online não está disponível para esta organização. Peça acesso a um administrador." };
  }

  const user = await prisma.user.create({
    data: {
      companyId: companies[0].id,
      name: parsed.data.name,
      email,
      passwordHash: await hash(parsed.data.password, 12),
      role: "member",
      mustChangePassword: false,
    },
  });

  if (centralEnabled()) {
    try {
      const central = await centralCreateTaskUser({
        email,
        name: parsed.data.name,
        password: parsed.data.password,
        localUserId: user.id,
      });
      if (!central.created) {
        await prisma.user.delete({ where: { id: user.id } });
        return { error: "Já existe uma conta F3F com este e-mail. Faça login com sua senha atual." };
      }
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } });
      console.error("[create-account] Central error:", error);
      return { error: "Não foi possível criar a conta agora. Tente novamente em instantes." };
    }
  }

  const login = await loginUser(email, parsed.data.password);
  if (login.error) return { error: "Conta criada, mas não foi possível iniciar a sessão. Faça login." };
  redirect("/dashboard");
}
