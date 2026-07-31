"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addChecklistItemAction, toggleChecklistItemAction, updateChecklistItemTitleAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, CheckSquare, Pencil, Check, X } from "lucide-react";
import type { TaskChecklistItem } from "@prisma/client";

export function ChecklistSection({
  taskId,
  items,
}: {
  taskId: string;
  items: TaskChecklistItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [editingItem]);

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const title = inputRef.current?.value.trim();
    if (!title) return;
    startTransition(async () => {
      await addChecklistItemAction(taskId, title);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function handleToggle(itemId: string, isDone: boolean) {
    startTransition(async () => {
      await toggleChecklistItemAction(itemId, taskId, isDone);
    });
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;
    const title = editInputRef.current?.value.trim() ?? "";
    if (!title) return;
    startTransition(async () => {
      const result = await updateChecklistItemTitleAction(editingItem.id, taskId, title);
      if (!result.error) setEditingItem(null);
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-neutral-500" />
          Checklist{" "}
          {items.length > 0 && (
            <span className="text-xs font-normal text-neutral-400">
              ({items.filter((i) => i.isDone).length}/{items.length})
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-500 h-7"
          onClick={() => {
            setShowInput(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Adicionar
        </Button>
      </div>

      {items.length === 0 && !showInput && (
        <p className="text-sm text-neutral-400 text-center py-4">
          Nenhum item ainda
        </p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 group"
          >
            <input
              type="checkbox"
              checked={item.isDone}
              onChange={(e) => handleToggle(item.id, e.target.checked)}
              disabled={isPending}
              className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
            />
            {editingItem?.id === item.id ? (
              <form onSubmit={handleSaveEdit} className="flex flex-1 items-center gap-1">
                <input
                  ref={editInputRef}
                  defaultValue={editingItem.title}
                  disabled={isPending}
                  onKeyDown={(e) => e.key === "Escape" && setEditingItem(null)}
                  className="min-w-0 flex-1 border-b border-neutral-300 bg-transparent py-1 text-sm text-neutral-900 outline-none focus:border-neutral-900"
                  aria-label="Editar nome do item"
                />
                <Button type="submit" variant="ghost" size="icon" className="h-7 w-7" disabled={isPending} title="Salvar">
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(null)} disabled={isPending} title="Cancelar">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </form>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm transition-colors ${
                    item.isDone
                      ? "line-through text-neutral-400"
                      : "text-neutral-700 group-hover:text-neutral-900"
                  }`}
                >
                  {item.title}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-neutral-400 hover:text-neutral-900"
                  onClick={() => setEditingItem({ id: item.id, title: item.title })}
                  disabled={isPending}
                  title="Editar item"
                  aria-label={`Editar ${item.title}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}

        {showInput && (
          <form onSubmit={handleAddItem} className="flex items-center gap-2 mt-1">
            <input
              ref={inputRef}
              type="text"
              placeholder="Novo item..."
              disabled={isPending}
              onKeyDown={(e) => e.key === "Escape" && setShowInput(false)}
              className="flex-1 text-sm border-b border-neutral-300 focus:border-neutral-900 outline-none py-1 bg-transparent text-neutral-900 placeholder:text-neutral-400"
            />
            <Button type="submit" size="sm" disabled={isPending} className="h-7 text-xs">
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Adicionar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowInput(false)}
            >
              Cancelar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
