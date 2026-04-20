import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionData } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/favicon.ico", "/_next", "/api/auth"];

const sessionSecret = process.env.SESSION_SECRET!;
const COOKIE_NAME = "f3f_session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
