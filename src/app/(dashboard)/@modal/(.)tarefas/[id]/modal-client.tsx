"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ModalClientProps {
  children: React.ReactNode;
  projectId?: string;
}

export function ModalClient({ children, projectId }: ModalClientProps) {
  const router = useRouter();

  const onClose = useCallback(() => {
    // router.back() é o jeito confiável de desmontar o slot @modal interceptado.
    // Se não houver histórico (acesso direto via URL), cai no fallback.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (projectId) {
      router.replace(`/projetos/${projectId}`);
    } else {
      router.replace("/dashboard");
    }
  }, [router, projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Fechar modal"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 px-4 overflow-y-auto">
        <div
          className="relative bg-[#f8f9fb] rounded-2xl w-full max-w-3xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors z-10"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content — mesma estrutura da página completa */}
          <div className="p-6 flex flex-col gap-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
