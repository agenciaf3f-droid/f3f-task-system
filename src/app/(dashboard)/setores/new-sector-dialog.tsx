"use client";

import { useState, useActionState, useEffect } from "react";
import { createSectorAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { DEFAULT_SECTOR_COLOR, SECTOR_COLORS } from "@/lib/sector-colors";

interface Manager { id: string; name: string }

export function NewSectorDialog({ managers }: { managers: Manager[] }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(DEFAULT_SECTOR_COLOR);
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(createSectorAction, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" />Novo setor</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar setor</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4 mt-2">
          <input type="hidden" name="color" value={color} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do setor</Label>
            <Input id="name" name="name" placeholder="Ex: Marketing" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" name="description" placeholder="Responsabilidades do setor..." disabled={isPending} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cor do setor</Label>
            <div className="flex gap-2 flex-wrap">
              {SECTOR_COLORS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={color === preset.value}
                  className={`w-7 h-7 rounded-full transition-all ${color === preset.value ? "ring-2 ring-offset-2 ring-neutral-900 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
            </div>
          </div>

          {managers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="managerId">Gestor responsável</Label>
              <select
                id="managerId"
                name="managerId"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Nenhum</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {state.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{state.error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar setor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
