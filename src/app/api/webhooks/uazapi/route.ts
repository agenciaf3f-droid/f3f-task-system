import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { applyClientResponse, extractButtonResponse } from "@/lib/meeting-reminders";

/**
 * A UAZAPI não assina os webhooks, então a autenticação é um segredo
 * compartilhado na própria URL configurada na instância.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.UAZAPI_WEBHOOK_TOKEN?.trim();
  if (!expected) return false;

  const url = new URL(request.url);
  const provided = url.searchParams.get("token")?.trim()
    ?? request.headers.get("x-webhook-token")?.trim();
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Reduz o payload à sua estrutura (chaves e tipos), sem valores.
 *
 * O corpo do webhook carrega conteúdo de conversa e telefone de cliente, que
 * não devem ir para o log. Só a forma interessa para descobrir onde a UAZAPI
 * coloca o botão escolhido.
 */
function describeShape(node: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (node === null) return "null";
  if (Array.isArray(node)) return node.length ? [describeShape(node[0], depth + 1)] : [];
  if (typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, value]) => [key, describeShape(value, depth + 1)]),
    );
  }
  return typeof node;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const parsed = extractButtonResponse(payload);
  if (!parsed) {
    // Evento que não é resposta de botão (mensagem comum, status de conexão) ou
    // formato ainda não mapeado. Nos dois casos: 200, para a UAZAPI não ficar
    // reenviando. A forma vai para o log só quando há indício de ser nosso.
    if (JSON.stringify(payload ?? null).includes("f3f-")) {
      console.warn(
        "[uazapi-webhook] resposta de botão não reconhecida:",
        JSON.stringify(describeShape(payload)),
      );
    }
    return NextResponse.json({ ok: true, handled: false });
  }

  try {
    const outcome = await applyClientResponse(parsed.meetingId, parsed.response);
    console.info("[uazapi-webhook] resposta do cliente aplicada", {
      meetingId: parsed.meetingId,
      response: parsed.response,
      ok: outcome.ok,
      detail: outcome.ok ? { alreadyHandled: outcome.alreadyHandled } : outcome.reason,
    });
    return NextResponse.json({ ok: true, handled: true, outcome });
  } catch (error) {
    console.error("[uazapi-webhook] falha ao aplicar resposta", {
      meetingId: parsed.meetingId,
      error,
    });
    return NextResponse.json({ ok: false, error: "apply_failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
