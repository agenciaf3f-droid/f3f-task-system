"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAccountAction, type CreateAccountState } from "./actions";

export default function CreateAccountPage() {
  const [state, action, isPending] = useActionState<CreateAccountState, FormData>(createAccountAction, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-2">
            <Image src="/logo.png" alt="F3F" width={40} height={40} priority className="h-10 w-10 object-contain" />
            <span className="text-xl font-semibold tracking-tight text-neutral-900">F3F Tasks</span>
          </div>
          <p className="text-sm text-neutral-500">Crie seu acesso ao sistema</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
          <form action={action} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Seu nome" autoComplete="name" required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" autoComplete="email" required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="Mínimo de 10 caracteres" autoComplete="new-password" required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordConfirmation">Confirmar senha</Label>
              <Input id="passwordConfirmation" name="passwordConfirmation" type="password" placeholder="Repita sua senha" autoComplete="new-password" required disabled={isPending} />
            </div>

            {state.error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</> : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Já possui uma conta? <Link href="/login" className="font-medium text-blue-600 hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
