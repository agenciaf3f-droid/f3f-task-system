"use client";

import { useState, useActionState } from "react";
import { createUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, AlertCircle, Mail } from "lucide-react";

interface Sector { id: string; name: string }

export function NewUserDialog({ sectors }: { sectors: Sector[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(createUserAction, {});

  if (state.success && open) setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo membro
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4 mt-2">
          <div className="flex items-start gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5 mb-1">
            <Mail className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Um e-mail com as credenciais de acesso será enviado automaticamente.</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" name="name" placeholder="João Silva" required disabled={isPending} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="joao@empresa.com" required disabled={isPending} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Papel</Label>
              <select
                id="role"
                name="role"
                defaultValue="member"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="member">Colaborador</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Gestor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {sectors.length > 0 && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="sectorId">Setor (opcional)</Label>
                <select
                  id="sectorId"
                  name="sectorId"
                  disabled={isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Nenhum</option>
                  {sectors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {state.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar membro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
