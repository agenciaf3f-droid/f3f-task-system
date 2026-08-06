import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TOKEN_HASH = "442d5008d1594ed22b326cadfb47dfc2e84d17a02aa9bb071c93268fbe1647e9";
const EMAIL = "iriacridesdamiaopinhas@gmail.com";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || createHash("sha256").update(token).digest("hex") !== TOKEN_HASH) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const localUser = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { isActive: true, deletedAt: true },
  });

  let centralAccount = false;
  const url = process.env.F3F_CENTRAL_SUPABASE_URL;
  const serviceKey = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return NextResponse.json({ error: "Falha ao consultar login central" }, { status: 502 });
      centralAccount = data.users.some((user) => (user.email ?? "").toLowerCase() === EMAIL);
      if (centralAccount || data.users.length < 200) break;
    }
  }

  return NextResponse.json({
    taskAccount: Boolean(localUser),
    taskAccountActive: Boolean(localUser?.isActive && !localUser.deletedAt),
    centralAccount,
  });
}
