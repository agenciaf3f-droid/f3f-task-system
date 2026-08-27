/**
 * Paleta fixa de cores de setor, ordenada por matiz para a escolha ficar fácil
 * de varrer. Cada cor leva um nome porque um círculo colorido sem rótulo não
 * diz nada para leitor de tela — e nem para quem não distingue duas delas.
 */
export const SECTOR_COLORS = [
  { value: "#6366f1", label: "Índigo"      },
  { value: "#3b82f6", label: "Azul"        },
  { value: "#0ea5e9", label: "Azul-céu"    },
  { value: "#06b6d4", label: "Ciano"       },
  { value: "#10b981", label: "Esmeralda"   },
  { value: "#84cc16", label: "Verde-limão" },
  { value: "#f59e0b", label: "Âmbar"       },
  { value: "#f97316", label: "Laranja"     },
  { value: "#ef4444", label: "Vermelho"    },
  { value: "#ec4899", label: "Rosa"        },
  { value: "#8b5cf6", label: "Violeta"     },
];

/** Cor de quem não escolheu nenhuma. */
export const DEFAULT_SECTOR_COLOR = "#6366f1";

/** Compara ignorando caixa: há setor gravado com hex em maiúsculas. */
export function isSameColor(left: string | null, right: string) {
  return (left ?? "").toLowerCase() === right.toLowerCase();
}

const TASK_SECTOR_COLORS: Record<string, string> = {
  "criação": "#38bdf8",
  "edicao de video": "#ef4444",
  "edição de vídeo": "#ef4444",
};

/** Mantém as cores operacionais consistentes mesmo para setores criados antes da paleta atual. */
export function getTaskSectorColor(name: string, storedColor: string | null) {
  return TASK_SECTOR_COLORS[name.trim().toLocaleLowerCase("pt-BR")] ?? storedColor ?? DEFAULT_SECTOR_COLOR;
}
