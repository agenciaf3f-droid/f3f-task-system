import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/github-oidc";
import { dispatchMeetingReminders } from "@/lib/meeting-reminders";
import { isUazapiConfigured, isUazapiTestMode } from "@/lib/whatsapp";

async function handle(request: Request): Promise<NextResponse> {
  const authorized = await isAuthorizedCronRequest(request, {
    audience: "f3f-task-meeting-reminders",
    workflowFile: "meeting-reminders.yml",
  });
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Interruptor de emergência: desliga os disparos sem precisar de deploy.
  if (process.env.MEETING_REMINDERS_ENABLED === "false") {
    return NextResponse.json({ ok: true, disabled: true });
  }

  if (!isUazapiConfigured()) {
    return NextResponse.json({ ok: false, error: "uazapi_not_configured" }, { status: 503 });
  }

  try {
    const result = await dispatchMeetingReminders();
    console.info("[meeting-reminders] executado", {
      testMode: isUazapiTestMode(),
      considered: result.considered,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped.length,
    });
    return NextResponse.json({ ok: true, testMode: isUazapiTestMode(), ...result });
  } catch (error) {
    console.error("[meeting-reminders] falhou", error);
    return NextResponse.json({ ok: false, error: "dispatch_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
