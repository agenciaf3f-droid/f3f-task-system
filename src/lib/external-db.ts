import { createClient } from "@supabase/supabase-js";

export type ClientData = {
  email: string;
  nome: string;
  plano: string;
  whatsapp_group_id: string;
  gestor?: string;
  user_id?: string;
};

type ExternalClientLookup = {
  email?: string | null;
  name: string;
};

function getExternalSupabase() {
  const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
  const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseKey);
}

function getExternalClientFields() {
  return {
    tableName: process.env.EXTERNAL_CLIENT_TABLE || "client_dashboards",
    emailField: process.env.EXTERNAL_FIELD_EMAIL || "email",
    passwordField: process.env.EXTERNAL_FIELD_PASSWORD || "senha",
    nameField: process.env.EXTERNAL_FIELD_NAME || "nome",
    planField: process.env.EXTERNAL_FIELD_PLAN || "plano",
    groupIdField: process.env.EXTERNAL_FIELD_GROUP_ID || "whatsapp_group_id",
    gestorField: process.env.EXTERNAL_FIELD_MANAGER_ID || "gestor",
  };
}

function mapClientData(
  data: Record<string, unknown>,
  fields: ReturnType<typeof getExternalClientFields>,
): ClientData {
  return {
    email: String(data[fields.emailField] ?? ""),
    nome: String(data[fields.nameField] ?? ""),
    plano: String(data[fields.planField] ?? ""),
    whatsapp_group_id: String(data[fields.groupIdField] ?? ""),
    gestor: data[fields.gestorField] ? String(data[fields.gestorField]) : undefined,
    user_id: data.user_id ? String(data.user_id) : undefined,
  };
}

export async function findClientByCredentials(
  email: string,
  password: string
): Promise<ClientData | null> {
  try {
    const externalSupabase = getExternalSupabase();
    const fields = getExternalClientFields();

    const emailNorm = email.trim().toLowerCase();
    const { data, error } = await externalSupabase
      .from(fields.tableName)
      .select(`${fields.emailField},${fields.passwordField},${fields.nameField},${fields.planField},${fields.groupIdField},${fields.gestorField}`)
      .ilike(fields.emailField, emailNorm)
      .maybeSingle();

    if (error) {
      console.error(`[external-db] query error for "${emailNorm}":`, error.message);
      return null;
    }
    if (!data) {
      console.warn(`[external-db] no row found for email="${emailNorm}" (table=${fields.tableName}, field=${fields.emailField})`);
      return null;
    }

    const storedPassword = data[fields.passwordField as keyof typeof data];
    const defaultPassword = "123456";

    // Se senha é null, usar default
    let passwordMatch = false;
    if (storedPassword === null || storedPassword === undefined) {
      passwordMatch = password === defaultPassword;
    } else {
      // Comparação direta (plaintext)
      passwordMatch = password === String(storedPassword);
    }

    if (!passwordMatch) return null;

    return mapClientData(data as unknown as Record<string, unknown>, fields);
  } catch (error) {
    console.error("Error fetching client from external DB:", error);
    return null;
  }
}

/**
 * Resolve os dados necessários ao agendamento sem pedir senha ao cliente.
 * Uso exclusivo em ações autenticadas do dashboard: primeiro tenta o e-mail
 * interno e, para cadastros legados sem e-mail, exige correspondência única
 * pelo nome completo.
 */
export async function findClientForBooking({
  email,
  name,
}: ExternalClientLookup): Promise<ClientData | null> {
  try {
    const externalSupabase = getExternalSupabase();
    const fields = getExternalClientFields();
    const selectedFields = `${fields.emailField},${fields.nameField},${fields.planField},${fields.groupIdField},${fields.gestorField}`;

    if (email?.trim()) {
      const { data, error } = await externalSupabase
        .from(fields.tableName)
        .select(selectedFields)
        .ilike(fields.emailField, email.trim())
        .limit(2);

      if (error) {
        console.error("[external-db] booking lookup by email failed:", error.message);
        return null;
      }
      if (data?.length === 1) return mapClientData(data[0] as unknown as Record<string, unknown>, fields);
      if ((data?.length ?? 0) > 1) {
        console.error("[external-db] booking lookup found duplicate emails");
        return null;
      }
    }

    const { data, error } = await externalSupabase
      .from(fields.tableName)
      .select(selectedFields)
      .ilike(fields.nameField, name.trim())
      .limit(2);

    if (error) {
      console.error("[external-db] booking lookup by name failed:", error.message);
      return null;
    }
    if (data?.length !== 1) {
      console.error(`[external-db] booking lookup by name returned ${data?.length ?? 0} rows`);
      return null;
    }

    return mapClientData(data[0] as unknown as Record<string, unknown>, fields);
  } catch (error) {
    console.error("[external-db] booking lookup failed:", error);
    return null;
  }
}
