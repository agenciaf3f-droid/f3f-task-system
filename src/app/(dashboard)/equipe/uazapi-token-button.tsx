"use client";

import { useState, useActionState } from "react";
import { setUazapiTokenAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, AlertCircle, KeyRound, Check } from "lucide-react";

/**
 * O token nunca é enviado para cá — só a informação de que existe. Trocar
 * significa colar o valor novo por cima; não há como ler o atual pela tela.
 */
export function UazapiTokenButton({
  userId,
  userName,
  hasToken,
}: {
  userId: string;
  userName: string;
  hasToken: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<{ error?: string; success?: boolean }, FormData>(
    async (previous, formData) => {
      const result = await setUazapiTokenAction(previous, formData);
      if (result.success) setOpen(false);
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            title={hasToken ? "Token da UAZAPI configurado" : "Sem token da UAZAPI"}
            className={hasToken ? "text-emerald-600" : "text-muted-foreground"}
          >
            {hasToken ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
            UAZAPI
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Token da UAZAPI — {userName}</DialogTitle>
        </DialogHeader>

        <form action={action} className="flex flex-col gap-4 mt-2">
          <input type="hidden" name="userId" value={userId} />

          <p className="text-xs text-muted-foreground">
            Token da instância do número pessoal deste gestor. Com ele, os disparos no modo
            &ldquo;número de cada gestor&rdquo; saem pelo WhatsApp dele. É guardado cifrado e não
            volta a aparecer nesta tela.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`token-${userId}`}>
              {hasToken ? "Novo token (substitui o atual)" : "Token"}
            </Label>
            <Input
              id={`token-${userId}`}
              name="token"
              type="password"
              autoComplete="off"
              placeholder="Cole o token da instância"
              disabled={isPending}
              autoFocus
            />
          </div>

          {state.error && (
            <div className="flex items-start gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
            {hasToken && (
              <Button
                type="submit"
                name="clear"
                value="1"
                variant="outline"
                disabled={isPending}
                className="text-red-600"
              >
                Remover
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
