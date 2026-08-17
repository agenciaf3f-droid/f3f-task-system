"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  status: string;
}

interface TopBarProps {
  userName: string;
  userAvatar?: string | null;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TopBar({ userName, userAvatar }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials = getInitials(userName);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") {
        setSearchOpen(false); setQuery(""); setResults([]);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery(""); setResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) return;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) { const data = await res.json(); setResults(data.tasks ?? []); }
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function selectResult(id: string) {
    setSearchOpen(false); setQuery(""); setResults([]);
    router.push(`/tarefas/${id}`);
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-3 bg-white border-b border-neutral-200/80 backdrop-blur-sm">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 10); }}
          className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-neutral-400 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors w-64"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-xs">Buscar tarefas...</span>
          <kbd className="text-[10px] text-neutral-300 bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-mono">⌘K</kbd>
        </button>

        {searchOpen && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-100">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  setQuery(nextQuery);
                  if (nextQuery.trim().length < 2) setResults([]);
                }}
                placeholder="Buscar por título..."
                className="flex-1 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-neutral-800 truncate flex-1">{r.title}</span>
                    <span className="text-xs text-neutral-400 shrink-0">{r.status}</span>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="px-3 py-6 text-center text-sm text-neutral-400">Nenhuma tarefa encontrada</div>
            ) : (
              <div className="px-3 py-4 text-center text-xs text-neutral-400">Digite para buscar tarefas</div>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Link href="/minha-conta">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover border border-neutral-200 hover:ring-2 hover:ring-blue-400 transition-all"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shadow shadow-blue-500/30 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer">
              {initials}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
