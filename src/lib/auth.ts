"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { compare } from "bcryptjs";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export async function getAuthUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return {
    userId: session.userId,
    companyId: session.companyId!,
    email: session.email!,
    name: session.name!,
    role: session.role!,
  };
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { mustChangePassword: true, avatarUrl: true, role: true },
  });
  if (dbUser?.mustChangePassword) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/minha-conta/senha")) redirect("/minha-conta/senha");
  }

  return {
    ...user,
    role: (dbUser?.role ?? user.role) as typeof user.role,
    avatarUrl: dbUser?.avatarUrl ?? null,
  };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim(), isActive: true, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) return { error: "Credenciais inválidas." };

  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) return { error: "Credenciais inválidas." };

  const session = await getSession();
  session.userId = user.id;
  session.companyId = user.companyId;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role;
  await session.save();

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { success: true };
}

export async function logoutUser() {
  const session = await getSession();
  session.destroy();
}
