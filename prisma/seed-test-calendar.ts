import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "agencia-f3f" } });
  if (!company) { console.error("Empresa não encontrada"); process.exit(1); }

  const email = "teste.calendario@agenciaf3f.com";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠️  Usuário já existe: ${existing.id}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Teste Calendário",
      email,
      passwordHash: await hash("Teste@2024", 10),
      role: "member",
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log(`✅ Usuário criado: ${user.id}`);
  console.log(`   Email: ${email}`);
  console.log(`   Senha: Teste@2024`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
