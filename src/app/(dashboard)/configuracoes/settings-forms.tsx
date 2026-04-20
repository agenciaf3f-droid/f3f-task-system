"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction, updateCompanyAction, saveWebhookAction } from "./actions";
import { Button } from "@/components/ui/button";

interface ProfileFormProps {
  name: string;
  email: string;
}

export function ProfileForm({ name, email }: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nome</label>
        <input
          name="name"
          defaultValue={name}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">E-mail</label>
        <input
          name="email"
          type="email"
          defaultValue={email}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Senha atual</label>
        <input
          name="currentPassword"
          type="password"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nova senha</label>
        <input
          name="newPassword"
          type="password"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Confirmar nova senha</label>
        <input
          name="confirmPassword"
          type="password"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Alterando..." : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}

interface WebhookFormProps {
  webhookUrl?: string;
  webhookSecret?: string;
  webhookActive?: boolean;
}

export function WebhookForm({ webhookUrl, webhookSecret, webhookActive = true }: WebhookFormProps) {
  const [state, action, pending] = useActionState(saveWebhookAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">URL do Webhook</label>
        <input
          name="url"
          type="url"
          defaultValue={webhookUrl ?? ""}
          placeholder="https://sua-api.com/webhook"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
        <p className="text-xs text-neutral-400 mt-1">
          Receberá um POST JSON a cada evento (tarefa atribuída, concluída, comentário).
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Secret (opcional)</label>
        <input
          name="secret"
          type="text"
          defaultValue={webhookSecret ?? ""}
          placeholder="chave-secreta"
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
        <p className="text-xs text-neutral-400 mt-1">
          Enviado no header <code className="bg-neutral-100 px-1 rounded">X-Webhook-Secret</code> para validação.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="hidden"
          name="isActive"
          value={webhookActive ? "true" : "false"}
        />
        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={webhookActive}
            onChange={(e) => {
              const hidden = e.currentTarget.closest("form")?.querySelector<HTMLInputElement>('input[name="isActive"]');
              if (hidden) hidden.value = e.currentTarget.checked ? "true" : "false";
            }}
            className="w-4 h-4 rounded border-neutral-300 text-neutral-900"
          />
          Webhook ativo
        </label>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Salvando..." : "Salvar webhook"}
        </Button>
      </div>
    </form>
  );
}

interface CompanyFormProps {
  companyName: string;
}

export function CompanyForm({ companyName }: CompanyFormProps) {
  const [state, action, pending] = useActionState(updateCompanyAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nome da empresa</label>
        <input
          name="name"
          defaultValue={companyName}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <div>
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Salvando..." : "Salvar empresa"}
        </Button>
      </div>
    </form>
  );
}
