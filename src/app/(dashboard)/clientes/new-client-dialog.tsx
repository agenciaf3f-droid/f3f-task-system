"use client";

import { useState, useActionState, useEffect } from "react";
import { createClientAction } from "@/app/(dashboard)/projetos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, AlertCircle } from "lucide-react";

export function NewClientDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(createClientAction, {});

  // Fecha o dialog só quando UM novo state.success chega (cada submit produz nova ref de state).
  // setState durante render deixava state.success "grudado" e o dialog fechava instantaneamente
  // ao reabrir após o primeiro sucesso.
  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" />Novo cliente</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar cliente</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do cliente</Label>
            <Input id="name" name="name" placeholder="Ex: Empresa ABC" required disabled={isPending} autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" name="description" placeholder="Notas sobre o cliente..." disabled={isPending} />
          </div>

          {state.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{state.error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
