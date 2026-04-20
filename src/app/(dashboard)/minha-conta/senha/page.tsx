import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ForceChangePasswordForm } from "./form";

export default async function MudarSenhaPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { mustChangePassword: true },
  });

  if (!dbUser?.mustChangePassword) redirect("/dashboard");

  return <ForceChangePasswordForm />;
}
