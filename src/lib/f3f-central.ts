// Login central F3F (Supabase Agenciaf3f — ulikfkemdawinetjyhok).
// A credencial (email+senha) mora em auth.users do projeto central; a tabela
// f3f_logins diz quem tem acesso a qual sistema. Cargo/permissão continuam
// 100% locais (tabela `users` do Prisma) — este módulo só autentica.
//
// Server-side apenas. Nenhuma destas envs é NEXT_PUBLIC.
// Com as envs ausentes, tudo cai no comportamento legado (bcrypt local),
// o que permite deployar este código antes de migrar os usuários.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SYSTEM = "task";

function centralUrl() {
  return process.env.F3F_CENTRAL_SUPABASE_URL;
}

export function centralEnabled(): boolean {
  return Boolean(centralUrl() && process.env.F3F_CENTRAL_SUPABASE_ANON_KEY);
}

function anonClient(): SupabaseClient {
  return createClient(centralUrl()!, process.env.F3F_CENTRAL_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function serviceClient(): SupabaseClient | null {
  const key = process.env.F3F_CENTRAL_SERVICE_ROLE_KEY;
  if (!centralUrl() || !key) return null;
  return createClient(centralUrl()!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findCentralUserByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers central: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Valida email+senha no central e confirma acesso ao sistema 'task'.
 * Retorna ok=false com motivo em caso de recusa; lança só em erro de infra.
 */
export async function centralVerifyPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; reason: "credenciais" | "sem_acesso" | "desativado" }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // 429/5xx não é senha errada — é infra; deixa o caller mostrar "tente de novo".
    if (error && typeof error.status === "number" && (error.status === 429 || error.status >= 500)) {
      throw new Error(`central signIn HTTP ${error.status}`);
    }
    return { ok: false, reason: "credenciais" };
  }

  const res = await fetch(`${centralUrl()}/functions/v1/f3f-auth-check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ system: SYSTEM }),
  });
  if (!res.ok) throw new Error(`f3f-auth-check HTTP ${res.status}`);
  const check = (await res.json()) as { allowed: boolean; reason?: string | null };

  if (!check.allowed) {
    return { ok: false, reason: check.reason === "desativado" ? "desativado" : "sem_acesso" };
  }
  return { ok: true };
}

/**
 * Define a senha da pessoa no central e propaga para o espelho do Console.Ads.
 * Usada pelos fluxos de troca/reset de senha (que não conhecem a senha antiga).
 * 1) service_role atualiza a senha no central;
 * 2) loga com a senha nova e chama a edge f3f-auth-set-password, que é quem
 *    sincroniza o espelho (mantém a lógica de espelho num lugar só).
 */
export async function centralSetPasswordEverywhere(
  email: string,
  newPassword: string,
): Promise<{ ok: boolean; warning?: string }> {
  try {
    return await setPasswordInner(email, newPassword);
  } catch (err) {
    // Erro de infra (ex.: listUsers fora do ar) vira {ok:false} controlado —
    // o caller decide abortar a troca, nunca exceção não tratada.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, warning: msg };
  }
}

async function setPasswordInner(
  email: string,
  newPassword: string,
): Promise<{ ok: boolean; warning?: string }> {
  const admin = serviceClient();
  if (!admin) return { ok: false, warning: "F3F_CENTRAL_SERVICE_ROLE_KEY ausente" };

  const user = await findCentralUserByEmail(admin, email);
  if (!user) return { ok: false, warning: `usuário ${email} não existe no central` };

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
    user_metadata: { ...user.user_metadata, must_change_password: false },
  });
  if (updErr) return { ok: false, warning: `update central: ${updErr.message}` };

  const { data, error: signErr } = await anonClient().auth.signInWithPassword({
    email,
    password: newPassword,
  });
  if (signErr || !data.session) {
    return { ok: true, warning: "central atualizado, mas sync do espelho não rodou" };
  }
  const res = await fetch(`${centralUrl()}/functions/v1/f3f-auth-set-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) return { ok: true, warning: `sync espelho HTTP ${res.status}` };
  return { ok: true };
}

/**
 * Garante que a pessoa existe no central com acesso ao 'task'.
 * - Se não existe: cria com a senha provisória informada.
 * - Se já existe (veio de outro sistema F3F): NÃO mexe na senha dela.
 * Retorna se a conta central já existia (muda o texto do email de convite).
 */
export async function centralProvisionTaskUser(params: {
  email: string;
  name: string;
  tempPassword: string;
  localUserId: string;
}): Promise<{ existedCentrally: boolean }> {
  const admin = serviceClient();
  if (!admin) throw new Error("F3F_CENTRAL_SERVICE_ROLE_KEY ausente");

  const { email, name, tempPassword, localUserId } = params;
  let centralUser = await findCentralUserByEmail(admin, email);
  const existedCentrally = Boolean(centralUser);

  if (!centralUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, must_change_password: true },
    });
    if (error || !data.user) throw new Error(`createUser central: ${error?.message ?? "falhou"}`);
    centralUser = data.user;
  }

  const { error: upsertErr } = await admin.from("f3f_logins").upsert(
    {
      auth_user_id: centralUser.id,
      email,
      system: SYSTEM,
      external_user_id: localUserId,
      active: true,
    },
    { onConflict: "email,system" },
  );
  if (upsertErr) throw new Error(`f3f_logins upsert: ${upsertErr.message}`);

  return { existedCentrally };
}

/**
 * Cria uma nova identidade F3F com acesso ao Tasks.
 * Diferente do convite administrativo, não reutiliza uma conta central já
 * existente: o cadastro público nunca deve alterar senha ou ampliar acesso
 * de uma identidade que já pertença a outra pessoa.
 */
export async function centralCreateTaskUser(params: {
  email: string;
  name: string;
  password: string;
  localUserId: string;
}): Promise<{ created: true } | { created: false; reason: "exists" }> {
  const admin = serviceClient();
  if (!admin) throw new Error("F3F_CENTRAL_SERVICE_ROLE_KEY ausente");

  const { email, name, password, localUserId } = params;
  if (await findCentralUserByEmail(admin, email)) return { created: false, reason: "exists" };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, must_change_password: false },
  });
  if (error || !data.user) throw new Error(`createUser central: ${error?.message ?? "falhou"}`);

  const { error: loginError } = await admin.from("f3f_logins").upsert(
    {
      auth_user_id: data.user.id,
      email,
      system: SYSTEM,
      external_user_id: localUserId,
      active: true,
    },
    { onConflict: "email,system" },
  );
  if (loginError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`f3f_logins upsert: ${loginError.message}`);
  }

  return { created: true };
}
