"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Globe2, Search, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface TaskTemplateOption {
  id: string;
  name: string;
  description: string | null;
  isPersonal: boolean;
  checklistItemCount: number;
}

interface TaskTemplatePickerProps {
  templates: TaskTemplateOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function TaskTemplatePicker({
  templates,
  value,
  onValueChange,
  disabled = false,
}: TaskTemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedTemplate = templates.find((template) => template.id === value);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.description ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch),
    );
  }, [search, templates]);

  const globalTemplates = filteredTemplates.filter((template) => !template.isPersonal);
  const personalTemplates = filteredTemplates.filter((template) => template.isPersonal);

  function selectTemplate(templateId: string) {
    onValueChange(templateId);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="templateId" value={value} />

      <Button
        type="button"
        variant="outline"
        disabled={disabled || templates.length === 0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "h-auto min-h-11 w-full justify-between gap-3 px-3 py-2.5 text-left",
          selectedTemplate && "border-blue-300 bg-blue-50/70 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300",
            selectedTemplate && "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
          )}>
            <Sparkles className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {selectedTemplate?.name ?? "Adicionar template para esta tarefa?"}
            </span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {selectedTemplate
                ? `${selectedTemplate.checklistItemCount} ${selectedTemplate.checklistItemCount === 1 ? "item será adicionado" : "itens serão adicionados"} à checklist`
                : templates.length > 0
                  ? "Escolha entre templates globais e os seus personalizados"
                  : "Nenhum template disponível"}
            </span>
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {selectedTemplate && !isOpen && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-3.5" />
          Remover template
        </button>
      )}

      {isOpen && (
        <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar template..."
                className="h-9 pl-8"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            <TemplateGroup
              title="Templates globais"
              icon={Globe2}
              templates={globalTemplates}
              selectedId={value}
              onSelect={selectTemplate}
            />
            <TemplateGroup
              title="Meus templates personalizados"
              icon={UserRound}
              templates={personalTemplates}
              selectedId={value}
              onSelect={selectTemplate}
            />

            {filteredTemplates.length === 0 && (
              <div className="px-3 py-8 text-center">
                <FileText className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Nenhum template encontrado</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Tente buscar por outro nome.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateGroup({
  title,
  icon: Icon,
  templates,
  selectedId,
  onSelect,
}: {
  title: string;
  icon: typeof Globe2;
  templates: TaskTemplateOption[];
  selectedId: string;
  onSelect: (templateId: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <div className="not-last:mb-3">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="space-y-1">
        {templates.map((template) => {
          const selected = template.id === selectedId;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
                selected && "bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100",
              )}
            >
              <span className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600",
                selected && "border-blue-600 bg-blue-600 text-white",
              )}>
                {selected && <Check className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{template.name}</span>
                {template.description && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {template.description}
                  </span>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {template.checklistItemCount} {template.checklistItemCount === 1 ? "item de checklist" : "itens de checklist"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
