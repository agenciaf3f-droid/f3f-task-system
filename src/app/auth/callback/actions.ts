"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function syncToIronSessionAction(): Promise<{
  error?: string;
  mustChangePassword?: boolean;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return { error: "no_session" };

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email, isActive: true, deletedAt: null },
    select: {
      id: true,
      companyId: true,
      email: true,
      name: true,
      role: true,
      mustChangePassword: true,
    },
  });

  if (!dbUser) return { error: "not_found" };

  const session = await getSession();
  session.userId = dbUser.id;
  session.companyId = dbUser.companyId;
  session.email = dbUser.email;
  session.name = dbUser.name;
  session.role = dbUser.role;
  await session.save();

  await prisma.user.update({
    where: { id: dbUser.id },
    data: { lastLoginAt: new Date() },
  });

  return { mustChangePassword: dbUser.mustChangePassword };
}
