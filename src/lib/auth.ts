import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

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
  return user;
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      companyId: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return { error: "Credenciais inválidas." };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { error: "Credenciais inválidas." };

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
