import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "F3F Tasks <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "não configurado";

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY não configurado" });
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: "agenciaf3f@gmail.com",
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
