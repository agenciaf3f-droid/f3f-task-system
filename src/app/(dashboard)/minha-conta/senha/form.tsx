"use client";

import { useActionState } from "react";
import { forceChangePasswordAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, KeyRound } from "lucide-react";

export function ForceChangePasswordForm() {
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    forceChangePasswordAction,
    {},
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center mb-4">
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Defina sua senha</h1>
          <p className="text-sm text-neutral-500 mt-1 text-center">
            Este é seu primeiro acesso. Crie uma senha pessoal para continuar.
          </p>
        </div>

        <form action={action} className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="Mínimo 6 caracteres"
              required
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repita a nova senha"
              required
              disabled={isPending}
            />
          </div>

          {state.error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full mt-1">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar e continuar
          </Button>
        </form>
      </div>
    </div>
  );
}
