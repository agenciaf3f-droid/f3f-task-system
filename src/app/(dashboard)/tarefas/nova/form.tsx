"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createTaskAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle, FolderOpen, CheckCircle2, Save } from "lucide-react";
import { RecurrencePicker, type RecurrenceRule } from "@/components/tasks/recurrence-picker";
import { ClientPicker } from "@/components/tasks/client-picker";
import { TaskTemplatePicker, type TaskTemplateOption } from "@/components/tasks/task-template-picker";
import { DEFAULT_PRIORITY, PRIORITY_OPTIONS } from "@/components/tasks/task-priority";

interface Sector { id: string; name: string }
interface User { id: string; name: string; sectorId: string | null }
interface Client { id: string; name: string }
interface Project { id: string; name: string; client: { name: string } }

interface TaskDraft {
  title: string;
  description: string;
  clientId: string;
  sectorId: string;
  assigneeId: string;
  dueDate: string;
  deliveryDate: string;
  priority: string;
  recurrenceRule: RecurrenceRule | null;
  templateId: string;
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

export function NewTaskForm({
  sectors,
  users,
  clients,
  project,
  keepOpenAfterCreate = false,
  defaultAssigneeId,
  defaultClientId,
  draftKey,
  templates,
  canChooseSector,
}: {
  sectors: Sector[];
  users: User[];
  clients: Client[];
  project: Project | null;
  keepOpenAfterCreate?: boolean;
  /** Pré-seleciona o responsável (ex.: tarefa avulsa da home → o próprio usuário). */
  defaultAssigneeId?: string;
  /** Pré-seleciona o cliente ao criar uma tarefa a partir do perfil dele. */
  defaultClientId?: string;
  /** Isola o rascunho por usuário e contexto (avulsa, cliente ou projeto). */
  draftKey: string;
  templates: TaskTemplateOption[];
  canChooseSector: boolean;
}) {
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean; createdTaskId?: string; redirectTo?: string },
    FormData
  >(createTaskAction, {});

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const preservedDraftRef = useRef<TaskDraft | null>(null);
  const handledCreatedTaskRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [justCreated, setJustCreated] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [preserveForNext, setPreserveForNext] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId ?? "");
  const [sectorId, setSectorId] = useState(
    users.find((item) => item.id === defaultAssigneeId)?.sectorId ?? "",
  );
  const draftStorageKey = `f3f-task-draft:${draftKey}:v1`;

  function collectDraft(overrides?: Partial<TaskDraft>): TaskDraft | null {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    return {
      title: String(data.get("title") ?? ""),
      description: String(data.get("description") ?? ""),
      clientId,
      sectorId: String(data.get("sectorId") ?? ""),
      assigneeId: String(data.get("assigneeId") ?? ""),
      dueDate: String(data.get("dueDate") ?? ""),
      deliveryDate: String(data.get("deliveryDate") ?? ""),
      priority: String(data.get("priority") || DEFAULT_PRIORITY),
      recurrenceRule,
      templateId,
      ...overrides,
    };
  }

  const storeDraft = useCallback((draft: TaskDraft | null) => {
    if (!draft) return;
    localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [draftStorageKey]);

  function scheduleDraftSave() {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => storeDraft(collectDraft()), 200);
  }

  useEffect(() => {
    const form = formRef.current;
    const raw = localStorage.getItem(draftStorageKey);
    if (!form || !raw) return;

    try {
      const draft = JSON.parse(raw) as TaskDraft;
      setFormValue(form, "title", draft.title ?? "");
      setFormValue(form, "description", draft.description ?? "");
      const restoredAssigneeId = defaultAssigneeId ?? draft.assigneeId ?? "";
      const automaticSectorId = users.find((item) => item.id === restoredAssigneeId)?.sectorId ?? "";
      setFormValue(form, "dueDate", draft.dueDate ?? "");
      setFormValue(form, "deliveryDate", draft.deliveryDate ?? "");
      setFormValue(form, "priority", draft.priority ?? DEFAULT_PRIORITY);
      const animationFrameId = window.requestAnimationFrame(() => {
        setAssigneeId(restoredAssigneeId);
        setSectorId(canChooseSector ? (draft.sectorId ?? automaticSectorId) : automaticSectorId);
        setClientId(defaultClientId ?? draft.clientId ?? "");
        setRecurrenceRule(draft.recurrenceRule ?? null);
        setTemplateId(draft.templateId ?? "");
      });
      return () => window.cancelAnimationFrame(animationFrameId);
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [canChooseSector, defaultAssigneeId, defaultClientId, draftStorageKey, users]);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    if (!state.createdTaskId || handledCreatedTaskRef.current === state.createdTaskId) return;
    handledCreatedTaskRef.current = state.createdTaskId;

    if (!keepOpenAfterCreate) {
      localStorage.removeItem(draftStorageKey);
      router.push(state.redirectTo ?? "/dashboard");
      return;
    }

    const form = formRef.current;
    if (form) {
      form.reset();
      const previous = preservedDraftRef.current;

      if (preserveForNext && previous) {
        const nextDraft = { ...previous, title: "" };
        setFormValue(form, "description", nextDraft.description);
        setAssigneeId(nextDraft.assigneeId);
        setSectorId(
          canChooseSector
            ? nextDraft.sectorId
            : (users.find((item) => item.id === nextDraft.assigneeId)?.sectorId ?? ""),
        );
        setFormValue(form, "dueDate", nextDraft.dueDate);
        setFormValue(form, "deliveryDate", nextDraft.deliveryDate);
        setFormValue(form, "priority", nextDraft.priority);
        setClientId(nextDraft.clientId);
        setRecurrenceRule(nextDraft.recurrenceRule);
        setTemplateId(nextDraft.templateId);
        storeDraft(nextDraft);
      } else {
        const nextAssigneeId = defaultAssigneeId ?? "";
        setAssigneeId(nextAssigneeId);
        setSectorId(users.find((item) => item.id === nextAssigneeId)?.sectorId ?? "");
        setClientId(defaultClientId ?? "");
        setRecurrenceRule(null);
        setTemplateId("");
        localStorage.removeItem(draftStorageKey);
      }

      // O modal fica aberto para criação em sequência. Atualiza a rota de fundo
      // para que o Kanban receba a tarefa nova sem exigir F5.
      router.refresh();
      setJustCreated(true);
      form.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
      const t = setTimeout(() => setJustCreated(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.createdTaskId, state.redirectTo, keepOpenAfterCreate, preserveForNext, defaultAssigneeId, defaultClientId, draftStorageKey, router, storeDraft, canChooseSector, users]);

  function handleClose() {
    // router.back() fecha o modal interceptado e também volta na página standalone
    router.back();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleClose}
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
          title="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          {project && (
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              {project.client.name} · {project.name}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-neutral-900">Nova tarefa</h1>
        </div>
      </div>

      <form
        ref={formRef}
        action={action}
        onInput={scheduleDraftSave}
        onChange={scheduleDraftSave}
        onSubmit={() => {
          const draft = collectDraft();
          preservedDraftRef.current = draft;
          storeDraft(draft);
        }}
        className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5"
      >
        {/* Hidden projectId */}
        {project && <input type="hidden" name="projectId" value={project.id} />}
        {keepOpenAfterCreate && <input type="hidden" name="keepOpen" value="1" />}

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">
            Título <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            placeholder="Descreva a tarefa claramente..."
            required
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Template da tarefa <span className="font-normal text-neutral-400">(opcional)</span></Label>
          <TaskTemplatePicker
            templates={templates}
            value={templateId}
            onValueChange={(value) => {
              setTemplateId(value);
              storeDraft(collectDraft({ templateId: value }));
            }}
            disabled={isPending}
          />
        </div>

        {!project && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">Cliente</Label>
            <ClientPicker
              id="clientId"
              name="clientId"
              clients={clients}
              value={clientId}
              onValueChange={(value) => {
                setClientId(value);
                storeDraft(collectDraft({ clientId: value }));
              }}
              disabled={isPending}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sectorId">Setor</Label>
          <select
            id="sectorId"
            name="sectorId"
            value={sectorId}
            onChange={(event) => setSectorId(event.target.value)}
            disabled={isPending || !canChooseSector}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Sem setor</option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>{sector.name}</option>
            ))}
          </select>
          {!canChooseSector && <input type="hidden" name="sectorId" value={sectorId} />}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            placeholder="Detalhes, contexto, instruções..."
            rows={4}
            disabled={isPending}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>

        {/* Row: Assignee */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assigneeId">Responsável <span className="text-red-500">*</span></Label>
          <select
            id="assigneeId"
            name="assigneeId"
            value={assigneeId}
            onChange={(event) => {
              const nextAssigneeId = event.target.value;
              const nextSectorId = users.find((item) => item.id === nextAssigneeId)?.sectorId ?? "";
              setAssigneeId(nextAssigneeId);
              setSectorId(nextSectorId);
            }}
            required
            disabled={isPending}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" disabled>Selecione o responsável</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Row: prazos + prioridade */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Prazo de conclusão <span className="text-red-500">*</span></Label>
            <Input id="dueDate" name="dueDate" type="date" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliveryDate">Prazo de entrega</Label>
            <Input id="deliveryDate" name="deliveryDate" type="date" disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Prioridade</Label>
            <select
              id="priority"
              name="priority"
              defaultValue={DEFAULT_PRIORITY}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Repetição</Label>
          <RecurrencePicker
            value={recurrenceRule}
            onValueChange={(value) => {
              setRecurrenceRule(value);
              storeDraft(collectDraft({ recurrenceRule: value }));
            }}
            disabled={isPending}
          />
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-800">
            <Save className="h-3.5 w-3.5" />
            Rascunho salvo automaticamente neste dispositivo
          </div>
          {keepOpenAfterCreate && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 border-t border-blue-100 pt-2 text-xs text-blue-900">
              <input
                type="checkbox"
                checked={preserveForNext}
                onChange={(event) => setPreserveForNext(event.target.checked)}
                disabled={isPending}
                className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
              />
              <span>
                <strong>Manter preenchimento para a próxima tarefa.</strong>
                <span className="block font-normal text-blue-700">Depois de criar, somente o título será limpo.</span>
              </span>
            </label>
          )}
        </div>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        {justCreated && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Tarefa criada. Pronto para a próxima.
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar tarefa
          </Button>
          <Button type="button" variant="outline" onClick={handleClose}>
            {keepOpenAfterCreate ? "Fechar" : "Cancelar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
