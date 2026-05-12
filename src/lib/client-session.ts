import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export type ClientSessionData = {
  clientEmail?: string;
  clientName?: string;
  clientPlan?: string;
  clientGroupId?: string;
  clientGestor?: string;
  bookingToken?: string;
};

const sessionConfig = {
  cookieName: "f3f_client_session",
  password: process.env.SESSION_SECRET || "",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 3600, // 1 hour
    sameSite: "lax" as const,
  },
};

export async function getClientSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<ClientSessionData>(
    cookieStore,
    sessionConfig
  );
  return session;
}

export async function setClientSession(data: ClientSessionData) {
  const cookieStore = await cookies();
  const session = await getIronSession<ClientSessionData>(
    cookieStore,
    sessionConfig
  );
  Object.assign(session, data);
  await session.save();
}

export async function clearClientSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<ClientSessionData>(
    cookieStore,
    sessionConfig
  );
  session.destroy();
}
