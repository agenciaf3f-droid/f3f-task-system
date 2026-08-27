"use client";

import { Sun, Moon, Palette } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const nextTheme: Record<Theme, Theme> = { light: "f3f-dark", "f3f-dark": "dark", dark: "light" };
  const nextLabel: Record<Theme, string> = { light: "Modo escuro F3F", "f3f-dark": "Modo escuro padrão", dark: "Modo claro" };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setTheme(nextTheme[theme]);
      }}
      title={`Trocar para ${nextLabel[theme]}`}
      aria-label={`Trocar para ${nextLabel[theme]}`}
      className={className}
    >
      {theme === "light" ? <Sun className="w-4 h-4" /> : theme === "f3f-dark" ? <Palette className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
