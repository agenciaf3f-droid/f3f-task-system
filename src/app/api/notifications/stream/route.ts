import { getAuthUser } from "@/lib/auth";
import { getNotificationsSince, getUnreadCount } from "@/lib/notifications";

// Stream SSE de notificações — entrega "quase instantânea" (~4s) usando o cookie
// de sessão atual (f3f_session). Sem Supabase Auth/realtime: o servidor faz o poll
// e empurra pro cliente via EventSource.
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel encerra em 300s; o EventSource reconecta sozinho

const POLL_MS = 4000;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const userId = user.userId;

  const encoder = new TextEncoder();
  // Cursor por createdAt: só pega notificações mais novas que a última vista.
  // Não avança quando vazio → sem gap e sem duplicata.
  let since = new Date();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      controller.enqueue(encoder.encode("retry: 5000\n\n"));
      send("ping", { ok: true });

      timer = setInterval(async () => {
        if (closed) return;
        try {
          const fresh = await getNotificationsSince(userId, since);
          if (closed) return;
          if (fresh.length > 0) since = fresh[fresh.length - 1].createdAt;
          // Envia unread em TODO tick (não só quando há item novo) → uma leitura feita
          // em outra aba/dispositivo reflete aqui em ~4s. Também serve de keep-alive.
          const unread = await getUnreadCount(userId);
          send("notifications", { items: fresh, unread });
        } catch {
          // erro transitório de DB — ignora, tenta no próximo tick
        }
      }, POLL_MS);
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
