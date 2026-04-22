"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ForgotState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckSquare, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [state, action, isPending] = useActionState<ForgotState, FormData>(forgotPasswordAction, {});

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
          <p className="text-sm text-neutral-500">Recuperação de senha</p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
          {state.success ? (
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-neutral-800">E-mail enviado</p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha em alguns minutos.
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-blue-600 hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-neutral-600 leading-relaxed mb-1">
                  Informe seu e-mail de acesso e enviaremos um link para criar uma nova senha.
                </p>
              </div>

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
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <Link
                href="/login"
                className="text-center text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
