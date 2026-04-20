"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [state, action, isPending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-neutral-900 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <span className="text-xl font-semibold tracking-tight text-neutral-900">
              F3F Tasks
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Entre para acessar o sistema
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
          <form action={action} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                required
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
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

            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          F3F Task System — uso interno
        </p>
      </div>
    </div>
  );
}
