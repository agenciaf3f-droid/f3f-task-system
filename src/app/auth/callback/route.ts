import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link_invalido`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=link_expirado`);
  }

  // Find user in our DB by email
  const user = await prisma.user.findUnique({
    where: { email: data.user.email, isActive: true, deletedAt: null },
    select: { id: true, companyId: true, email: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=usuario_nao_encontrado`);
  }

  // Create iron-session so the rest of the app works normally
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

  // If next param is set (e.g. from password reset), use it
  const next = searchParams.get("next");
  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // First access: force password change
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });

  if (dbUser?.mustChangePassword) {
    return NextResponse.redirect(`${origin}/minha-conta/senha`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
