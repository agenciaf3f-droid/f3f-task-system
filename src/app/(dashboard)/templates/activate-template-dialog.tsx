"use client";

import { useState, useTransition } from "react";
import { activateTemplateAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface User { id: string; name: string }

export function ActivateTemplateDialog({
  templateId,
  templateName,
  taskCount,
  users,
}: {
  templateId: string;
  templateName: string;
  taskCount: number;
  users: User[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 16),
  );

  function handleActivate() {
    startTransition(async () => {
      const result = await activateTemplateAction(templateId, assigneeId, startDate);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`${taskCount} tarefa${taskCount !== 1 ? "s" : ""} criada${taskCount !== 1 ? "s" : ""} com sucesso!`);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" className="w-full text-xs">
          <Play className="w-3.5 h-3.5 mr-1.5" />
          Ativar template
        </Button>
      } />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Ativar: {templateName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 mt-1">
          <p className="text-sm text-neutral-500">
            Isso vai gerar <strong>{taskCount} tarefa{taskCount !== 1 ? "s" : ""}</strong> automaticamente.
          </p>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Responsável pelas tarefas</Label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Data de início (base para prazos)</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleActivate} disabled={isPending} className="flex-1">
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />Ativar</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
