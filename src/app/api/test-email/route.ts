import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET(request: Request) {
  const debugEnabled = process.env.ENABLE_EMAIL_DEBUG_ROUTES === "true";
  if (process.env.NODE_ENV === "production" && !debugEnabled) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const debugToken = process.env.EMAIL_DEBUG_TOKEN;
  if (debugToken && process.env.NODE_ENV === "production") {
    const url = new URL(request.url);
    const providedToken = url.searchParams.get("token");
    if (providedToken !== debugToken) {
      return NextResponse.json({ ok: false, error: "token inválido" }, { status: 403 });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "não configurado";
  const debugTo = process.env.EMAIL_DEBUG_TO;

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY não configurado" });
  }
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: "RESEND_FROM_EMAIL não configurado" });
  }
  if (!debugTo) {
    return NextResponse.json({ ok: false, error: "EMAIL_DEBUG_TO não configurado" });
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: debugTo,
      subject: "Teste de email — F3F Tasks",
      html: `<p>Email de teste enviado com sucesso!</p><p>FROM: ${fromEmail}</p><p>APP_URL: ${appUrl}</p>`,
    });

    return NextResponse.json({
      ok: true,
      from: fromEmail,
      appUrl,
      resendId: result.data?.id ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      from: fromEmail,
      error: String(err),
    });
  }
}
