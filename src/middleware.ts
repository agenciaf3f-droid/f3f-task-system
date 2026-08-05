import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth/callback", "/agendar", "/favicon.ico", "/_next", "/api/auth", "/api/agendar", "/api/test-email", "/api/cron", "/api/internal/account-credentials-update"];

const sessionSecret = process.env.SESSION_SECRET!;
const COOKIE_NAME = "f3f_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
