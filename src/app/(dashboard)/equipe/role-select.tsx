"use client";

import { useState, useTransition } from "react";
import { updateUserRoleAction } from "./actions";

const ROLES = [
  { value: "member", label: "Colaborador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "manager", label: "Gestor" },
  { value: "admin", label: "Admin" },
];

const ROLE_RING: Record<string, string> = {
  admin: "text-red-700 border-red-200 bg-red-50",
  manager: "text-blue-700 border-blue-200 bg-blue-50",
  supervisor: "text-blue-700 border-blue-200 bg-blue-50",
  member: "text-neutral-600 border-neutral-200 bg-neutral-50",
};

export function RoleSelect({ userId, current }: { userId: string; current: string }) {
  const [role, setRole] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const res = await updateUserRoleAction(userId, next);
      if (res?.error) {
        setRole(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <select
        value={role}
        onChange={onChange}
        disabled={pending}
        aria-label="Cargo do membro"
        className={`text-xs font-medium border rounded-md pl-2 pr-6 py-1 cursor-pointer transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-300 ${ROLE_RING[role] ?? ROLE_RING.member}`}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value} className="bg-white text-neutral-800">
            {r.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-600 max-w-[160px] text-right">{error}</span>}
    </div>
  );
}
