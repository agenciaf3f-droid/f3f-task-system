"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loga o erro completo no console do navegador pra debug
    console.error("[GlobalError]", error, "\ndigest:", error?.digest, "\nstack:", error?.stack);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f9fafb" }}>
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", padding: "2rem",
        }}>
          <div style={{
            background: "white", border: "1px solid #e5e7eb", borderRadius: "1rem",
            padding: "2.5rem", maxWidth: "420px", width: "100%", textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "12px",
              background: "#fef2f2", display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 1.25rem",
              fontSize: "1.5rem",
            }}>
              ⚠
            </div>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", margin: "0 0 0.5rem" }}>
              Erro no servidor
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
              Algo deu errado ao processar sua ação.
            </p>
            {(error?.message || error?.digest) && (
              <pre style={{
                fontSize: "0.75rem", color: "#b91c1c", background: "#fef2f2",
                border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.75rem",
                margin: "0 0 1.25rem", textAlign: "left", whiteSpace: "pre-wrap",
                wordBreak: "break-word", maxHeight: "200px", overflow: "auto", fontFamily: "monospace",
              }}>
                {error?.message || "Erro no servidor"}
                {error?.digest ? `\n\nID: ${error.digest}` : ""}
              </pre>
            )}
            <button
              onClick={reset}
              style={{
                background: "#1d4ed8", color: "white", border: "none",
                borderRadius: "0.5rem", padding: "0.625rem 1.25rem",
                fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
