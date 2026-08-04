"use client";

import { useState, type ReactNode } from "react";
import { History, ListChecks } from "lucide-react";

export function TaskContentTabs({
  details,
  history,
}: {
  details: ReactNode;
  history: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Detalhes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <History className="w-4 h-4" />
          Histórico
        </button>
      </div>

      {activeTab === "details" ? details : history}
    </div>
  );
}
