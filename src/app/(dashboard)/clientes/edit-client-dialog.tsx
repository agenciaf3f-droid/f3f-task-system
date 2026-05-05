"use client";

import { useState, useActionState, useEffect, useRef, useTransition } from "react";
import { Pencil, Loader2, AlertCircle, Camera, Trash2 } from "lucide-react";
import { updateClientAction, updateClientAvatarAction, removeClientAvatarAction } from "../projetos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";

interface EditClientDialogProps {
  client: {
    id: string;
    name: string;
    color: string | null;
    avatarUrl: string | null;
    description: string | null;
  };
}

export function EditClientDialog({ client }: EditClientDialogProps) {
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(client.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(updateClientAction, {});

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    const fd = new FormData();
    fd.append("avatar", file);
    startUpload(async () => {
      const res = await updateClientAvatarAction(client.id, fd);
      if (res.error) setAvatarError(res.error);
      else if (res.avatarUrl) setAvatarUrl(res.avatarUrl);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleRemoveAvatar() {
    startUpload(async () => {
      await removeClientAvatarAction(client.id);
      setAvatarUrl(null);
    });
  }

  // Dep precisa ser `state` (não `state.success`) — cada submit gera nova ref de state,
  // mas state.success continua === true, então useEffect não re-dispara no 2º submit.
  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

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

            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="relative">
                <UserAvatar name={client.name} src={avatarUrl} size={72} bgColor={client.color} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                  title="Enviar foto"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Remover foto
                </button>
              )}
              {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" defaultValue={client.name} required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Plano / Descrição</Label>
              <textarea
                id="description"
                name="description"
                defaultValue={client.description ?? ""}
                disabled={isPending}
                rows={3}
                placeholder="Ex: Plano Pro, contrato mensal..."
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
              />
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
