"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { syncToIronSessionAction } from "./actions";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Autenticando...");

  useEffect(() => {
    async function handle() {
      const supabase = createSupabaseBrowserClient();

      // detectSessionInUrl is true by default — handles both #access_token and ?code=
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        setMessage("Link inválido ou expirado. Redirecionando...");
        setTimeout(() => router.push("/login?error=link_expirado"), 2000);
        return;
      }

      const result = await syncToIronSessionAction();

      if (result.error) {
        setMessage("Usuário não encontrado. Redirecionando...");
        setTimeout(() => router.push("/login?error=usuario_nao_encontrado"), 2000);
        return;
      }

      const next = searchParams.get("next");
      if (next) {
        router.push(next);
      } else if (result.mustChangePassword) {
        router.push("/minha-conta/senha");
      } else {
        router.push("/dashboard");
      }
    }

    handle();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
        <p className="text-sm text-neutral-500">{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-700 rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
