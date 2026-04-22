"use client";

import { use, useActionState } from "react";
import { resetPasswordAction, type ResetState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const boundAction = resetPasswordAction.bind(null, token);
  const [state, action, isPending] = useActionState<ResetState, FormData>(boundAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-neutral-900">F3F Tasks</span>
          </div>
          <p className="text-sm text-neutral-500">Criar nova senha</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
          <form action={action} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                required
                disabled={isPending}
              />
            </div>

            {state.error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
