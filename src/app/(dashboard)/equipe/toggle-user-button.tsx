"use client";

import { useTransition } from "react";
import { toggleUserActiveAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ToggleUserButton({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`text-xs h-7 ${isActive ? "text-neutral-500 hover:text-red-600" : "text-neutral-400 hover:text-green-600"}`}
      disabled={isPending}
      onClick={() => startTransition(() => toggleUserActiveAction(userId))}
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isActive ? (
        "Desativar"
      ) : (
        "Reativar"
      )}
    </Button>
  );
}
