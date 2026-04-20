import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "F3F Tasks <onboarding@resend.dev>";

export async function sendInviteEmail({
  toEmail,
  toName,
  tempPassword,
  invitedByName,
  companyName,
}: {
  toEmail: string;
  toName: string;
  tempPassword: string;
  invitedByName: string;
  companyName: string;
}) {
  if (!resend) {
    console.log(`[DEV] Invite email for ${toEmail}: senha=${tempPassword}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `Você foi convidado para ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <!-- Header -->
    <div style="background:#0f1117;border-radius:16px 16px 0 0;padding:28px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;background:#7c3aed;border-radius:10px;display:flex;align-items:center;justify-content:center;">
        <span style="color:white;font-size:18px;font-weight:700;">⚡</span>
      </div>
      <span style="color:white;font-size:18px;font-weight:700;">F3F Tasks</span>
    </div>

    <!-- Body -->
    <div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:none;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
        Olá, ${toName}! 👋
      </h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
        <strong>${invitedByName}</strong> convidou você para acessar o <strong>${companyName}</strong> no F3F Tasks.
      </p>

      <!-- Credentials box -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;">
          Suas credenciais de acesso
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <span style="font-size:12px;color:#9ca3af;">E-mail</span>
            <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#111827;">${toEmail}</p>
          </div>
          <div>
            <span style="font-size:12px;color:#9ca3af;">Senha temporária</span>
            <p style="margin:2px 0 0;font-size:16px;font-weight:700;color:#7c3aed;font-family:'Courier New',monospace;letter-spacing:0.05em;">${tempPassword}</p>
          </div>
        </div>
      </div>

      <p style="margin:0 0 20px;font-size:13px;color:#9ca3af;background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
        ⚠️ Você será solicitado a trocar a senha no primeiro acesso.
      </p>

      <!-- CTA Button -->
      <a href="${APP_URL}/login"
         style="display:block;text-align:center;background:#7c3aed;color:white;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;">
        Acessar o sistema →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        F3F Tasks · Se você não esperava este convite, ignore este e-mail.
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}
