"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBroadcastAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Loader2, Ban } from "lucide-react";

export function CancelBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          // Mensagem já entregue não volta: o cancelamento só impede o que ainda
          // está na fila, e o usuário precisa saber disso antes de confirmar.
          if (!confirm("Cancelar o que ainda não foi enviado? Mensagens já entregues não voltam.")) return;
          setError(null);
          startTransition(async () => {
            const result = await cancelBroadcastAction(broadcastId);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Ban className="w-3.5 h-3.5 mr-1.5" />}
        Cancelar
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
