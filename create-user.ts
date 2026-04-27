import { prisma } from "./src/lib/prisma";
import bcrypt from "bcryptjs";

async function createUser() {
  const name = "Rafinha";
  const email = "rdlecal342@gmail.com";
  const password = "123456";

  // Verificar se usuário já existe
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log("❌ Usuário já existe");
    return;
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 10);

  // Criar usuário
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "member",
      isActive: true,
      companyId: "cm0hpqkjm0000o5fkcsl8h3ej", // ID da primeira company
    },
  });

  console.log("✅ Usuário criado!");
  console.log(`- Nome: ${user.name}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- ID: ${user.id}`);
}

createUser()
  .then(() => process.exit(0))
  .catch(e => {
    console.error("❌ Erro:", e.message);
    process.exit(1);
  });
