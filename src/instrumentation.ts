// Captura TODO erro de Server Component / Route Handler / Action com detalhe
// completo (mensagem, stack, digest, rota) nos logs do Vercel. O digest que
// aparece pro usuário na tela bate com o "digest" logado aqui → dá pra achar
// a causa exata de qualquer "Erro no servidor".
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string };
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  },
) {
  const e = err as { message?: string; stack?: string; digest?: string };
  const payload = {
    digest: e?.digest ?? null,
    message: e?.message ?? null,
    path: request?.path ?? null,
    route_path: context?.routePath ?? null,
    route_type: context?.routeType ?? null,
    stack: e?.stack ?? null,
  };
  console.error("[onRequestError]", JSON.stringify(payload, null, 2));

  // Persiste no DB pra debug (lê via SQL depois). Best-effort.
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    await supabaseAdmin.from("error_logs").insert(payload);
  } catch (logErr) {
    console.error("[onRequestError] falha ao gravar error_logs:", logErr);
  }
}
