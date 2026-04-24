import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET(request: Request) {
  const debugEnabled = process.env.ENABLE_EMAIL_DEBUG_ROUTES === "true";
  if (process.env.NODE_ENV === "production" && !debugEnabled) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const debugToken = process.env.EMAIL_DEBUG_TOKEN;
  if (debugToken) {
    const url = new URL(request.url);
    const providedToken = url.searchParams.get("token");
    if (providedToken !== debugToken) {
      return NextResponse.json({ ok: false, error: "token inválido" }, { status: 403 });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const debugTo = process.env.EMAIL_DEBUG_TO;

  const diagnostics: Record<string, unknown> = {
    env: {
      RESEND_API_KEY: apiKey ? `✅ definida (${apiKey.slice(0, 8)}...)` : "❌ NÃO DEFINIDA",
      RESEND_FROM_EMAIL: fromEmail,
      NEXT_PUBLIC_APP_URL: appUrl,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  if (!apiKey) {
    return NextResponse.json({ ...diagnostics, resultado: "❌ RESEND_API_KEY não configurada — reinicie o servidor após configurar o .env" }, { status: 500 });
  }
  if (!fromEmail) {
    return NextResponse.json({ ...diagnostics, resultado: "❌ RESEND_FROM_EMAIL não configurado" }, { status: 500 });
  }
  if (!debugTo) {
    return NextResponse.json({ ...diagnostics, resultado: "❌ EMAIL_DEBUG_TO não configurado" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  // Step 1: validate key via Resend API
  try {
    const domains = await resend.domains.list();
    diagnostics.dominios_resend = {
      ok: !domains.error,
      dados: domains.data ?? null,
      erro: domains.error ?? null,
    };
  } catch (e) {
    diagnostics.dominios_resend = { ok: false, erro: String(e) };
  }

  // Step 2: send test email
  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: debugTo,
      subject: "[DEBUG] Teste de email — F3F Tasks",
      html: `
        <p><strong>Email de diagnóstico enviado com sucesso!</strong></p>
        <p>FROM: ${fromEmail}</p>
        <p>APP_URL: ${appUrl}</p>
        <p>NODE_ENV: ${process.env.NODE_ENV}</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    diagnostics.envio_email = {
      ok: !result.error,
      resend_id: result.data?.id ?? null,
      erro: result.error ?? null,
    };
  } catch (e) {
    diagnostics.envio_email = { ok: false, erro: String(e) };
  }

  return NextResponse.json({
    ...diagnostics,
    resultado: (diagnostics.envio_email as Record<string, unknown>)?.ok
      ? "✅ Email enviado — verifique agenciaf3f@gmail.com (e spam)"
      : "❌ Falha ao enviar — veja o campo envio_email.erro",
  });
}
