import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionData } from "@/lib/session";

// "/api/webhooks": chamado por serviço externo, que não tem sessão. A própria
// rota exige o segredo compartilhado (UAZAPI_WEBHOOK_TOKEN) — sem esta entrada
// aqui o middleware redireciona para /login e o webhook nunca chega no handler.
//
// "/logo.png" e "/apple-touch-icon.png": arquivos de marca exibidos nas telas
// públicas. O <Image> do Next busca a origem por uma requisição interna que
// passa por aqui, e essa requisição não tem sessão — então sem estas entradas o
// otimizador recebia um 307 para /login e a logo simplesmente não aparecia em
// login, criar-conta, esqueci-senha e redefinir-senha. Na sidebar funcionava
// porque ali o usuário já está logado, o que escondia o problema.
const PUBLIC_PATHS = ["/login", "/criar-conta", "/esqueci-senha", "/redefinir-senha", "/auth/callback", "/agendar", "/favicon.ico", "/logo.png", "/apple-touch-icon.png", "/_next", "/api/auth", "/api/agendar", "/api/test-email", "/api/cron", "/api/webhooks"];

const sessionSecret = process.env.SESSION_SECRET!;
const COOKIE_NAME = "f3f_session";
const CANONICAL_HOST = "task.agenciaf3f.com.br";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (
    process.env.NODE_ENV === "production" &&
    host !== CANONICAL_HOST &&
    !pathname.startsWith("/api/cron")
  ) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = CANONICAL_HOST;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const passThrough = () => NextResponse.next({ request: { headers: requestHeaders } });

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return passThrough();

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const session = await unsealData<SessionData>(cookie, {
      password: sessionSecret,
    });
    if (!session.userId) throw new Error("No user");
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return passThrough();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
