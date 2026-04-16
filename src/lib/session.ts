import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { UserRole } from "@prisma/client";

export interface SessionData {
  userId?: string;
  companyId?: string;
  email?: string;
  name?: string;
  role?: UserRole;
}

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set in .env and be at least 32 characters long.",
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret,
  cookieName: "f3f_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
