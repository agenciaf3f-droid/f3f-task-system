import { getAuthUser } from "@/lib/auth";
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications";

// Snapshot atual de notificações + contagem não-lida.
// O cliente chama isto ao (re)conectar o SSE, fechando o gap entre o render inicial
// e o stream, e o gap da janela de reconexão.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ items: [], unread: 0 }, { status: 401 });
  const [items, unread] = await Promise.all([
    getRecentNotifications(user.userId, 15),
    getUnreadCount(user.userId),
  ]);
  return Response.json({ items, unread });
}
