import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "agencia-f3f" } });
  if (!company) { console.error("Empresa não encontrada"); process.exit(1); }

  // Buscar setor Marketing pelo nome
  const sector = await prisma.sector.findFirst({
    where: { name: { contains: "marketing", mode: "insensitive" } },
  });
  if (!sector) { console.error("Setor Marketing não encontrado"); process.exit(1); }
  console.log(`Setor encontrado: ${sector.name} (${sector.id})`);

  const email = "schmoellerpaulo@gmail.com";
  const name = "Paulo Schmoeller";
  const password = "123456";
  const role = "supervisor";

  // Remove do Supabase Auth se já existir
  const { data: existingAuth } = await supabase.auth.admin.listUsers();
  const existingSupabase = existingAuth.users.find((u) => u.email === email);
  if (existingSupabase) {
    await supabase.auth.admin.deleteUser(existingSupabase.id);
    console.log("Usuário removido do Supabase Auth (limpeza)");
  }

  // Remove do banco se já existir
  const existingDb = await prisma.user.findUnique({ where: { email } });
  if (existingDb) {
    await prisma.sectorMember.deleteMany({ where: { userId: existingDb.id } });
    await prisma.user.delete({ where: { email } });
    console.log("Usuário removido do banco (limpeza)");
  }

  // Cria no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (authError) {
    console.error("Erro no Supabase Auth:", authError.message);
    process.exit(1);
  }

  console.log(`Usuário criado no Supabase Auth: ${authData.user.id}`);

  // Cria no banco
  const dbUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name,
      email,
      passwordHash: "supabase-auth",
      role,
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log(`Usuário criado no banco: ${dbUser.id}`);

  // Adiciona ao setor Marketing
  await prisma.sectorMember.create({
    data: { sectorId: sector.id, userId: dbUser.id },
  });

  console.log(`\nPaulo criado como supervisor de Marketing!`);
  console.log(`   Email: ${email}`);
  console.log(`   Senha: ${password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
