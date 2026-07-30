// TEMPORÁRIO — limpeza única pós-cutover do login central F3F:
// 1. unifica o email da Iria no padrão do central (…pinhas@, o do Hub)
// 2. zera users.password_hash de TODOS (credencial local morta; login valida
//    no central — passo final do plano de cutover)
// Proteção: header x-migrate-key = F3F_CENTRAL_SERVICE_ROLE_KEY. REMOVER depois.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const key = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!key || request.headers.get("x-migrate-key") !== key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const iria = await prisma.user.updateMany({
    where: { email: "iriacridesdamiaopinhasilva@gmail.com" },
    data: { email: "iriacridesdamiaopinhas@gmail.com" },
  });

  const zeroed = await prisma.user.updateMany({
    where: { passwordHash: { not: "" } },
    data: { passwordHash: "" },
  });

  return NextResponse.json({ iria_email_atualizado: iria.count, hashes_zerados: zeroed.count });
}
