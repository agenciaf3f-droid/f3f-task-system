"use client";

import { useState, useActionState } from "react";
import { createClientAction } from "@/app/(dashboard)/projetos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, AlertCircle } from "lucide-react";

type Manager = { id: string; name: string };

export function NewClientDialog({ managers }: { managers: Manager[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(async (previousState, formData) => {
    const result = await createClientAction(previousState, formData);
    if (result.success) setOpen(false);
    return result;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" />Novo cliente</Button>} />
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar cliente</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do cliente</Label>
            <Input id="name" name="name" placeholder="Ex: Empresa ABC" required disabled={isPending} autoFocus />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="managerId">Gestor responsável</Label>
            <select
              id="managerId"
              name="managerId"
              required
              disabled={isPending}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue=""
            >
              <option value="">Selecione um gestor</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meetingPlan">Plano</Label>
            <Input id="meetingPlan" name="meetingPlan" placeholder="Ex: 16 FASES" required disabled={isPending} />
            <p className="text-xs text-neutral-400">Define a duração e a frequência das reuniões.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappGroupName">Grupo do WhatsApp</Label>
            <Input id="whatsappGroupName" name="whatsappGroupName" placeholder="Ex: F3F - Cliente - Plano" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappGroupId">ID do grupo</Label>
            <Input id="whatsappGroupId" name="whatsappGroupId" placeholder="120363...@g.us" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail do cliente (opcional)</Label>
            <Input id="email" name="email" type="email" placeholder="cliente@empresa.com" disabled={isPending} />
            <p className="text-xs text-neutral-400">Usado como identificação adicional do cliente.</p>
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
