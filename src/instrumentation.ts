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
  console.error(
    "[onRequestError]",
    JSON.stringify(
      {
        digest: e?.digest,
        message: e?.message,
        path: request?.path,
        method: request?.method,
        routePath: context?.routePath,
        routeType: context?.routeType,
        stack: e?.stack,
      },
      null,
      2,
    ),
  );
}
