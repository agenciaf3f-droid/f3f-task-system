import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type EmailConfig =
  | { ok: true; client: Resend; from: string }
  | { ok: false; reason: string };

function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY ausente" };
  if (!from) return { ok: false, reason: "RESEND_FROM_EMAIL ausente" };
  return { ok: true, client: new Resend(apiKey), from };
}

// ─── Layout base ──────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <div style="background:#0f1117;border-radius:16px 16px 0 0;padding:24px 32px;display:flex;align-items:center;gap:12px;">
      <div style="width:32px;height:32px;background:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:15px;">F</div>
      <span style="color:white;font-size:17px;font-weight:700;">F3F Tasks</span>
    </div>
    ${content}
    <div style="padding:20px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">F3F Tasks &middot; Se você não esperava este e-mail, ignore-o.</p>
    </div>
  </div>
</body>
</html>`;
}

function emailBody(inner: string) {
  return `<div style="background:white;padding:32px;border:1px solid #e5e7eb;border-top:none;">${inner}</div>`;
}

function primaryButton(href: string, label: string) {
  return `<a href="${href}" style="display:block;text-align:center;background:#2563eb;color:white;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;text-decoration:none;margin-top:24px;">${label}</a>`;
}

function infoBox(content: string) {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:20px 0;">${content}</div>`;
}

function warningBox(content: string) {
  return `<div style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;">${content}</div>`;
}

// ─── Invite ───────────────────────────────────────────────────

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
  const config = getEmailConfig();
  if (!config.ok) {
    console.log(`[DEV] Invite email desativado (${config.reason}) → ${toEmail} | senha=${tempPassword}`);
    return;
  }
  const { client, from } = config;

  const html = emailWrapper(emailBody(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Olá, ${toName}!</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      <strong>${invitedByName}</strong> convidou você para acessar o <strong>${companyName}</strong> no F3F Tasks.
    </p>
    ${infoBox(`
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;">Suas credenciais de acesso</p>
      <div>
        <span style="font-size:12px;color:#9ca3af;">E-mail</span>
        <p style="margin:2px 0 10px;font-size:14px;font-weight:600;color:#111827;">${toEmail}</p>
        <span style="font-size:12px;color:#9ca3af;">Senha temporária</span>
        <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#2563eb;font-family:'Courier New',monospace;letter-spacing:0.08em;">${tempPassword}</p>
      </div>
    `)}
    ${warningBox("Você será solicitado a trocar a senha no primeiro acesso.")}
    ${primaryButton(`${APP_URL}/login`, "Acessar o sistema")}
  `));

  await client.emails.send({
    from,
    to: toEmail,
    subject: `Você foi convidado para ${companyName} — F3F Tasks`,
    html,
  });
}

// ─── Task assigned ────────────────────────────────────────────

export async function sendTaskAssignedEmail({
  toEmail,
  toName,
  taskId,
  taskTitle,
  projectName,
  dueDate,
  priority,
  assignedByName,
}: {
  toEmail: string;
  toName: string;
  taskId: string;
  taskTitle: string;
  projectName: string | null;
  dueDate: string | null;
  priority: string;
  assignedByName: string;
}) {
  const config = getEmailConfig();
  if (!config.ok) {
    console.log(`[DEV] Task assigned email desativado (${config.reason}) → ${toEmail} | task=${taskTitle}`);
    return;
  }
  const { client, from } = config;

  const priorityLabel: Record<string, string> = {
    low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
  };
  const priorityColor: Record<string, string> = {
    low: "#6b7280", medium: "#2563eb", high: "#ea580c", urgent: "#dc2626",
  };

  const html = emailWrapper(emailBody(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Nova tarefa atribuída</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Olá, <strong>${toName}</strong>! <strong>${assignedByName}</strong> atribuiu uma tarefa para você.
    </p>
    ${infoBox(`
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827;">${taskTitle}</p>
      ${projectName ? `<p style="margin:4px 0 12px;font-size:13px;color:#6b7280;">Projeto: ${projectName}</p>` : "<div style='margin-bottom:12px;'></div>"}
      <div style="display:flex;gap:24px;flex-wrap:wrap;">
        <div>
          <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Prioridade</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${priorityColor[priority] ?? "#6b7280"};">${priorityLabel[priority] ?? priority}</p>
        </div>
        ${dueDate ? `<div>
          <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Prazo</span>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#111827;">${dueDate}</p>
        </div>` : ""}
      </div>
    `)}
    ${primaryButton(`${APP_URL}/tarefas/${taskId}`, "Ver tarefa")}
  `));

  await client.emails.send({
    from,
    to: toEmail,
    subject: `Tarefa atribuída: ${taskTitle}`,
    html,
  });
}

// ─── Due date reminder ────────────────────────────────────────

export async function sendDueReminderEmail({
  toEmail,
  toName,
  tasks,
}: {
  toEmail: string;
  toName: string;
  tasks: { id: string; title: string; projectName: string | null; dueDate: string; isOverdue: boolean }[];
}) {
  const config = getEmailConfig();
  if (!config.ok) {
    console.log(`[DEV] Due reminder email desativado (${config.reason}) → ${toEmail} | tasks=${tasks.length}`);
    return;
  }
  const { client, from } = config;

  const overdue = tasks.filter((t) => t.isOverdue);
  const dueToday = tasks.filter((t) => !t.isOverdue);

  function taskRow(t: { id: string; title: string; projectName: string | null; dueDate: string; isOverdue: boolean }) {
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
          <a href="${APP_URL}/tarefas/${t.id}" style="font-size:14px;font-weight:600;color:#111827;text-decoration:none;">${t.title}</a>
          ${t.projectName ? `<p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${t.projectName}</p>` : ""}
        </td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">
          <span style="font-size:12px;font-weight:600;color:${t.isOverdue ? "#dc2626" : "#d97706"};">${t.dueDate}</span>
        </td>
      </tr>`;
  }

  const html = emailWrapper(emailBody(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Tarefas pendentes</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Olá, <strong>${toName}</strong>! Você tem tarefas que precisam de atenção.
    </p>
    ${overdue.length > 0 ? `
      <p style="font-size:13px;font-weight:700;color:#dc2626;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em;">Atrasadas (${overdue.length})</p>
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">${overdue.map(taskRow).join("")}</table>
    ` : ""}
    ${dueToday.length > 0 ? `
      <p style="font-size:13px;font-weight:700;color:#d97706;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.06em;">Vencem hoje (${dueToday.length})</p>
      <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">${dueToday.map(taskRow).join("")}</table>
    ` : ""}
    ${primaryButton(`${APP_URL}/tarefas`, "Ver todas as tarefas")}
  `));

  await client.emails.send({
    from,
    to: toEmail,
    subject: `${overdue.length > 0 ? `${overdue.length} tarefa${overdue.length !== 1 ? "s" : ""} atrasada${overdue.length !== 1 ? "s" : ""} — ` : ""}F3F Tasks`,
    html,
  });
}

// ─── Password reset ───────────────────────────────────────────

export async function sendPasswordResetEmail({
  toEmail,
  toName,
  resetToken,
}: {
  toEmail: string;
  toName: string;
  resetToken: string;
}) {
  const config = getEmailConfig();
  if (!config.ok) {
    console.log(`[DEV] Password reset email desativado (${config.reason}) → ${toEmail} | token=${resetToken}`);
    return;
  }
  const { client, from } = config;

  const resetUrl = `${APP_URL}/redefinir-senha/${resetToken}`;

  const html = emailWrapper(emailBody(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Redefinição de senha</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Olá, <strong>${toName}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta.
    </p>
    ${primaryButton(resetUrl, "Redefinir senha")}
    ${warningBox("Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.")}
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
      Ou cole este link no navegador:<br/>${resetUrl}
    </p>
  `));

  await client.emails.send({
    from,
    to: toEmail,
    subject: "Redefinição de senha — F3F Tasks",
    html,
  });
}
