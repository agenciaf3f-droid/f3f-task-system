"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  status: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.tasks ?? []);
        }
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function selectResult(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/tarefas/${id}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 10);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Buscar tarefas</span>
        <kbd className="ml-2 text-[10px] text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título..."
              className="flex-1 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none bg-transparent"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); }}>
                <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto py-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectResult(r.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-neutral-800 truncate flex-1">
                    {r.title}
                  </span>
                  <span className="text-xs text-neutral-400 shrink-0">{r.status}</span>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="px-3 py-6 text-center text-sm text-neutral-400">
              Nenhuma tarefa encontrada
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-neutral-400">
              Digite para buscar tarefas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
