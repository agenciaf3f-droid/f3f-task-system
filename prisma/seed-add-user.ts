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

  const email = "rdlecal342@gmail.com";
  const name = "Rafinha";
  const password = "rdlecal342";
  const role = "supervisor";
  const sectorId = "a0ae889d-3ebc-405a-9e94-99a5c3b4c48f"; // Marketing

  // Verifica se já existe no DB
  const existingDb = await prisma.user.findUnique({ where: { email } });
  if (existingDb) {
    console.log(`⚠️  Usuário "${email}" já existe no banco (id: ${existingDb.id})`);
    return;
  }

  // Cria no Supabase Auth com senha direta
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pula verificação de email
    user_metadata: { name },
  });

  if (authError) {
    console.error("Erro no Supabase Auth:", authError.message);
    process.exit(1);
  }

  console.log(`✅ Usuário criado no Supabase Auth: ${authData.user.id}`);

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

  console.log(`✅ Usuário criado no banco: ${dbUser.id}`);

  // Adiciona ao setor Marketing
  await prisma.sectorMember.create({
    data: { sectorId, userId: dbUser.id },
  });

  console.log(`✅ Adicionado ao setor Marketing`);
  console.log(`\n🎉 Rafinha criado como supervisor de Marketing!`);
  console.log(`   Email: ${email}`);
  console.log(`   Senha: ${password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
