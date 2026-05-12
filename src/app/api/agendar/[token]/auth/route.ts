import { NextResponse } from "next/server";
import { setClientSession } from "@/lib/client-session";
import { findClientByCredentials } from "@/lib/external-db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email e senha são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const client = await findClientByCredentials(email, password);

    if (!client) {
      return NextResponse.json(
        { ok: false, error: "Email ou senha incorretos" },
        { status: 401 }
      );
    }

    // Set session
    await setClientSession({
      clientEmail: client.email,
      clientName: client.nome,
      clientPlan: client.plano,
      clientGroupId: client.whatsapp_group_id,
      clientGestor: client.gestor,
      bookingToken: token,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Auth] Erro ao fazer login:", error);
    return NextResponse.json(
      { ok: false, error: "Erro ao fazer login" },
      { status: 500 }
    );
  }
}
