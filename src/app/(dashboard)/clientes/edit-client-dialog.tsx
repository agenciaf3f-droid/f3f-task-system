"use client";

import { useState, useActionState, useEffect } from "react";
import { Pencil, Loader2, AlertCircle } from "lucide-react";
import { updateClientAction } from "../projetos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRESET_COLORS = [
  "#6366f1","#f59e0b","#10b981","#ec4899","#3b82f6",
  "#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316",
];

interface EditClientDialogProps {
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    color: string | null;
  };
}

export function EditClientDialog({ client }: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(client.color ?? "#6366f1");
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(updateClientAction, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Editar cliente"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <form action={action} className="flex flex-col gap-4 mt-2">
            <input type="hidden" name="clientId" value={client.id} />
            <input type="hidden" name="color" value={color} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={client.name} required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" name="phone" defaultValue={client.phone ?? ""} disabled={isPending} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-neutral-900" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {state.error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {state.error}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
