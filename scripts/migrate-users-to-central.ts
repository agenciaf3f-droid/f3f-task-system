// Migra os usuários ativos do Tasks para o login central F3F (uma vez, no cutover).
// - importa o hash bcrypt existente → a pessoa MANTÉM a senha atual
// - cria a linha em f3f_logins (system='task')
// - não mexe em quem já existe no central (senha de lá prevalece)
//
// Rodar:  npx tsx scripts/migrate-users-to-central.ts [--dry-run]
// Envs:   DATABASE_URL, F3F_CENTRAL_SUPABASE_URL, F3F_CENTRAL_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.F3F_CENTRAL_SUPABASE_URL;
  const key = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("F3F_CENTRAL_SUPABASE_URL / F3F_CENTRAL_SERVICE_ROLE_KEY ausentes");
  const central = createClient(url, key, { auth: { persistSession: false } });

  // Usuários do central, indexados por email.
  const centralByEmail = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await central.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) centralByEmail.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }

  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  console.log(`${users.length} usuários ativos no Tasks; ${centralByEmail.size} contas no central.`);

  for (const u of users) {
    const email = u.email.toLowerCase();
    let centralId = centralByEmail.get(email);

    if (!centralId) {
      // Não existe no central → importa com o MESMO hash bcrypt (senha preservada).
      if (DRY_RUN) {
        console.log(`[dry] criaria ${email} (hash importado)`);
      } else {
        const { data, error } = await central.auth.admin.createUser({
          email,
          password_hash: u.passwordHash,
          email_confirm: true,
          user_metadata: { name: u.name },
        });
        if (error || !data.user) {
          console.error(`✗ ${email}: createUser falhou — ${error?.message}`);
          continue;
        }
        centralId = data.user.id;
        console.log(`✓ ${email}: criado no central (senha preservada)`);
      }
    } else {
      console.log(`= ${email}: já existe no central (senha de lá prevalece)`);
    }

    if (!DRY_RUN && centralId) {
      const { error } = await central.from("f3f_logins").upsert(
        { auth_user_id: centralId, email, system: "task", external_user_id: u.id, active: true },
        { onConflict: "email,system" },
      );
      if (error) console.error(`✗ ${email}: f3f_logins — ${error.message}`);
    }
  }

  console.log(DRY_RUN ? "Dry-run concluído." : "Migração concluída.");
  console.log("Valide um login antes de setar F3F_CENTRAL_SUPABASE_ANON_KEY em produção.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro:", e.message ?? e);
    process.exit(1);
  });
