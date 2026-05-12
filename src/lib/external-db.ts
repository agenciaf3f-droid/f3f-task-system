import { createClient } from "@supabase/supabase-js";

export type ClientData = {
  email: string;
  nome: string;
  plano: string;
  whatsapp_group_id: string;
  gestor?: string;
  user_id?: string;
};

function getExternalSupabase() {
  const supabaseUrl = process.env.EXTERNAL_SUPABASE_URL;
  const supabaseKey = process.env.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing EXTERNAL_SUPABASE_URL or EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function findClientByCredentials(
  email: string,
  password: string
): Promise<ClientData | null> {
  try {
    const externalSupabase = getExternalSupabase();
    const tableName = process.env.EXTERNAL_CLIENT_TABLE || "client_dashboards";
    const emailField = process.env.EXTERNAL_FIELD_EMAIL || "email";
    const passwordField = process.env.EXTERNAL_FIELD_PASSWORD || "senha";
    const nameField = process.env.EXTERNAL_FIELD_NAME || "nome";
    const planField = process.env.EXTERNAL_FIELD_PLAN || "plano";
    const groupIdField = process.env.EXTERNAL_FIELD_GROUP_ID || "whatsapp_group_id";
    const gestorField = process.env.EXTERNAL_FIELD_MANAGER_ID || "gestor";

    const { data, error } = await externalSupabase
      .from(tableName)
      .select(`${emailField},${passwordField},${nameField},${planField},${groupIdField},${gestorField}`)
      .eq(emailField, email)
      .single();

    if (error || !data) return null;

    const storedPassword = data[passwordField as keyof typeof data];
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

    return {
      email: data[emailField as keyof typeof data] as string,
      nome: data[nameField as keyof typeof data] as string,
      plano: data[planField as keyof typeof data] as string,
      whatsapp_group_id: data[groupIdField as keyof typeof data] as string,
      gestor: data[gestorField as keyof typeof data] as string | undefined,
      user_id: data["user_id" as keyof typeof data] as string | undefined,
    };
  } catch (error) {
    console.error("Error fetching client from external DB:", error);
    return null;
  }
}
