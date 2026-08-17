import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/github-oidc";
import { meetingRemindersEnabled, reconcileMeetingReminders } from "@/lib/meeting-reminders";
import { isUazapiConfigured, isUazapiTestMode } from "@/lib/whatsapp";

/**
 * Reconciliação diária dos lembretes de reunião.
 *
 * NÃO envia nada e não verifica se chegou a hora — disso a fila da própria
 * UAZAPI cuida, que é o que mantém os lembretes saindo mesmo com a Vercel fora
 * do ar. Aqui só se conserta divergência: agendamento que falhou por queda de
 * rede na marcação, cancelamento que não chegou ao outro lado e reunião que
 * entrou no horizonte de agendamento.
 *
 * Uma execução por dia.
 */
async function handle(request: Request): Promise<NextResponse> {
  const authorized = await isAuthorizedCronRequest(request, {
    audience: "f3f-task-meeting-reminders",
    workflowFile: "meeting-reminders.yml",
  });
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!meetingRemindersEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  if (!isUazapiConfigured()) {
    return NextResponse.json({ ok: false, error: "uazapi_not_configured" }, { status: 503 });
  }

  try {
    const result = await reconcileMeetingReminders();
    console.info("[meeting-reminders] reconciliado", { testMode: isUazapiTestMode(), ...result });
    return NextResponse.json({ ok: true, testMode: isUazapiTestMode(), ...result });
  } catch (error) {
    console.error("[meeting-reminders] reconciliação falhou", error);
    return NextResponse.json({ ok: false, error: "reconcile_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

// Varre as reuniões futuras; com a base atual roda bem abaixo disso.
export const maxDuration = 300;
export const dynamic = "force-dynamic";
