"use client";

import { useMemo, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createBroadcastAction, uploadBroadcastMediaAction } from "./actions";
import { BROADCAST_VARIABLES, applyVariables } from "@/lib/broadcast-variables";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Plus, Loader2, AlertCircle, FileText, Image as ImageIcon, Video, Mic,
  BarChart3, Trash2, Upload, Check, Search,
} from "lucide-react";

type Client = {
  id: string;
  name: string;
  externalId: string | null;
  meetingPlan: string | null;
  areas: string[];
  whatsappGroupId: string;
};

const semAcento = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Atalhos de seleção. Os quatro primeiros vêm das caixas da aba "ÁREA" da
 * planilha; "Página de vendas" é PLANO, não área — foi como a agência
 * classificou esse serviço.
 *
 * Os segmentos SE SOBREPÕEM de propósito: 83 dos 103 clientes ativos têm mais
 * de uma área marcada, então somar dois segmentos não dá a soma dos números.
 */
const SEGMENTS: { key: string; label: string; match: (client: Client) => boolean }[] = [
  { key: "todos", label: "Todos os ativos", match: () => true },
  { key: "trafego", label: "Gestão de tráfego", match: (c) => c.areas.includes("trafego") },
  { key: "design", label: "Design", match: (c) => c.areas.includes("design") },
  { key: "especialista", label: "Especialista", match: (c) => c.areas.includes("especialista") },
  { key: "video", label: "Edição de vídeo", match: (c) => c.areas.includes("video") },
  {
    key: "pagina-vendas",
    label: "Página de vendas",
    match: (c) => semAcento(c.meetingPlan ?? "").includes("pagina de venda"),
  },
];

type MessageType = "text" | "image" | "video" | "audio" | "poll";

/** Conteúdo de um disparo existente, para abrir o formulário já preenchido. */
export type BroadcastPrefill = {
  name: string;
  delayMin: number;
  delayMax: number;
  clientIds: string[];
  messages: { type: MessageType; text: string; fileUrl: string | null; fileName: string | null; choices: string[] }[];
};

type DraftMessage = {
  key: string;
  type: MessageType;
  text: string;
  fileUrl: string | null;
  fileName: string | null;
  choices: string[];
  uploading?: boolean;
  uploadError?: string | null;
};

const TYPE_META: Record<MessageType, { label: string; icon: React.ElementType; accept?: string }> = {
  text:  { label: "Texto",   icon: FileText },
  image: { label: "Imagem",  icon: ImageIcon, accept: "image/jpeg,image/png,image/webp" },
  video: { label: "Vídeo",   icon: Video,     accept: "video/mp4,video/quicktime,video/webm" },
  audio: { label: "Áudio",   icon: Mic,       accept: "audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac" },
  poll:  { label: "Enquete", icon: BarChart3 },
};

let messageCounter = 0;
const newMessage = (type: MessageType): DraftMessage => ({
  key: `m${++messageCounter}`,
  type,
  text: "",
  fileUrl: null,
  fileName: null,
  choices: type === "poll" ? ["", ""] : [],
});

export function NewBroadcastDialog({
  clients,
  prefill,
}: {
  clients: Client[];
  /** Vem de /disparos?duplicar=<id>. Presente = abre já preenchido. */
  prefill?: BroadcastPrefill | null;
}) {
  const router = useRouter();
  // Abre sozinho quando chegou por duplicação — o usuário já clicou uma vez.
  const [open, setOpen] = useState(Boolean(prefill));
  const [messages, setMessages] = useState<DraftMessage[]>(
    () => prefill?.messages.map((m) => ({ ...newMessage(m.type), ...m })) ?? [],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(prefill?.clientIds ?? []));
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"now" | "scheduled">("now");
  const formRef = useRef<HTMLFormElement>(null);

  // Fechar precisa tirar o ?duplicar= da URL, senão reabrir o formulário do
  // zero traria o conteúdo duplicado de volta.
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && prefill) router.replace("/disparos");
  }

  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean; broadcastId?: string },
    FormData
  >(async (previous, formData) => {
    formData.set("clientIds", JSON.stringify([...selected]));
    formData.set(
      "messages",
      JSON.stringify(
        messages.map((message) => ({
          type: message.type,
          text: message.text,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          choices: message.type === "poll" ? message.choices.filter((c) => c.trim()) : [],
          selectableCount: message.type === "poll" ? 1 : null,
        })),
      ),
    );
    if (mode === "now") formData.set("scheduledFor", "");
    const result = await createBroadcastAction(previous, formData);
    if (result.success) {
      setOpen(false);
      setMessages([]);
      setSelected(new Set());
      if (result.broadcastId) router.push(`/disparos/${result.broadcastId}`);
    }
    return result;
  }, {});

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.externalId ?? "").toLowerCase().includes(term) ||
        (c.meetingPlan ?? "").toLowerCase().includes(term),
    );
  }, [clients, search]);

  const preview = useMemo(() => {
    const first = clients.find((c) => selected.has(c.id)) ?? clients[0];
    const context = first
      ? { name: first.name, externalId: first.externalId }
      : { name: "Cliente Exemplo", externalId: "000" };
    return { context, client: first };
  }, [clients, selected]);

  function update(key: string, patch: Partial<DraftMessage>) {
    setMessages((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  }

  async function handleUpload(message: DraftMessage, file: File) {
    update(message.key, { uploading: true, uploadError: null });
    const data = new FormData();
    data.set("file", file);
    data.set("kind", message.type);
    const result = await uploadBroadcastMediaAction({}, data);
    update(message.key, {
      uploading: false,
      uploadError: result.error ?? null,
      fileUrl: result.url ?? null,
      fileName: result.fileName ?? null,
    });
  }

  const toggleAll = () => {
    setSelected((current) =>
      filtered.every((c) => current.has(c.id))
        ? new Set([...current].filter((id) => !filtered.some((c) => c.id === id)))
        : new Set([...current, ...filtered.map((c) => c.id)]),
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" />Novo disparo</Button>} />
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo disparo</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={action} className="grid gap-5 md:grid-cols-[1fr_320px] mt-2">
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome do disparo</Label>
              <Input id="name" name="name" placeholder="Ex: Aviso de reunião" required disabled={isPending} autoFocus
                defaultValue={prefill?.name ?? ""} />
            </div>

            {/* ─── Destinatários ─── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Grupos ({selected.size} de {clients.length})</Label>
                <button type="button" onClick={toggleAll} disabled={isPending}
                  className="text-xs text-primary hover:underline">
                  {filtered.every((c) => selected.has(c.id)) && filtered.length > 0
                    ? "Desmarcar exibidos" : "Selecionar exibidos"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEGMENTS.map((segment) => {
                  const matches = clients.filter(segment.match);
                  return (
                    <button
                      key={segment.key}
                      type="button"
                      disabled={isPending || matches.length === 0}
                      onClick={() => setSelected(new Set(matches.map((c) => c.id)))}
                      className="text-xs rounded-full border px-2.5 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {segment.label} <span className="text-muted-foreground">({matches.length})</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} disabled={isPending}
                  placeholder="Buscar por nome, plano ou ID" className="pl-8 h-9" />
              </div>
              <div className="border rounded-md max-h-44 overflow-y-auto divide-y">
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum cliente encontrado.</p>
                )}
                {filtered.map((client) => {
                  const checked = selected.has(client.id);
                  return (
                    <label key={client.id}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/50">
                      <input type="checkbox" checked={checked} disabled={isPending}
                        onChange={() => setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(client.id)) next.delete(client.id); else next.add(client.id);
                          return next;
                        })} />
                      <span className="truncate flex-1">{client.name}</span>
                      {client.externalId && (
                        <span className="text-[10px] text-muted-foreground shrink-0">#{client.externalId}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ─── Mensagens ─── */}
            <div className="flex flex-col gap-2">
              <Label>Mensagens</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_META) as MessageType[]).map((type) => {
                  const Icon = TYPE_META[type].icon;
                  return (
                    <Button key={type} type="button" variant="outline" size="sm" disabled={isPending}
                      onClick={() => setMessages((l) => [...l, newMessage(type)])}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" />{TYPE_META[type].label}
                    </Button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 mt-1">
                {messages.map((message, index) => {
                  const meta = TYPE_META[message.type];
                  const Icon = meta.icon;
                  return (
                    <div key={message.key} className="border rounded-md p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Icon className="w-3.5 h-3.5" />
                        {index + 1}. {meta.label}
                        <button type="button" disabled={isPending} className="ml-auto text-red-500 hover:text-red-600"
                          onClick={() => setMessages((l) => l.filter((m) => m.key !== message.key))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {meta.accept && (
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-accent">
                            {message.uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {message.fileUrl ? "Trocar arquivo" : "Escolher arquivo"}
                            <input type="file" accept={meta.accept} className="hidden" disabled={isPending || message.uploading}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(message, f); }} />
                          </label>
                          {message.fileUrl && (
                            <span className="text-xs text-emerald-600 inline-flex items-center gap-1 truncate">
                              <Check className="w-3 h-3 shrink-0" />{message.fileName}
                            </span>
                          )}
                        </div>
                      )}
                      {message.uploadError && (
                        <p className="text-xs text-red-500">{message.uploadError}</p>
                      )}

                      <textarea
                        value={message.text}
                        disabled={isPending}
                        onChange={(e) => update(message.key, { text: e.target.value })}
                        rows={message.type === "poll" ? 2 : 3}
                        placeholder={
                          message.type === "poll" ? "Pergunta da enquete"
                            : message.type === "text" ? "Escreva a mensagem. Use as variáveis ao lado."
                              : "Legenda (opcional)"
                        }
                        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      />

                      {message.type === "poll" && (
                        <div className="flex flex-col gap-1.5">
                          {message.choices.map((choice, choiceIndex) => (
                            <div key={choiceIndex} className="flex gap-1.5">
                              <Input value={choice} disabled={isPending} className="h-8 text-sm"
                                placeholder={`Opção ${choiceIndex + 1}`}
                                onChange={(e) => update(message.key, {
                                  choices: message.choices.map((c, i) => (i === choiceIndex ? e.target.value : c)),
                                })} />
                              {message.choices.length > 2 && (
                                <button type="button" disabled={isPending} className="text-red-500 px-1"
                                  onClick={() => update(message.key, {
                                    choices: message.choices.filter((_, i) => i !== choiceIndex),
                                  })}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {message.choices.length < 12 && (
                            <button type="button" disabled={isPending} className="text-xs text-primary hover:underline self-start"
                              onClick={() => update(message.key, { choices: [...message.choices, ""] })}>
                              + opção
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground border border-dashed rounded-md py-6 text-center">
                    Nenhuma mensagem. Escolha um tipo acima.
                  </p>
                )}
              </div>
            </div>

            {/* ─── Intervalo ─── */}
            <div className="border rounded-md p-3 flex flex-col gap-2">
              <Label className="text-sm">Intervalo entre mensagens</Label>
              <p className="text-xs text-muted-foreground">
                A UAZAPI sorteia um tempo dentro desta faixa a cada mensagem, para o WhatsApp não
                identificar um padrão de robô.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Input name="delayMin" type="number" min={1} max={3600} defaultValue={prefill?.delayMin ?? 15}
                  disabled={isPending} className="w-20 h-9" />
                <span className="text-muted-foreground">até</span>
                <Input name="delayMax" type="number" min={1} max={3600} defaultValue={prefill?.delayMax ?? 30}
                  disabled={isPending} className="w-20 h-9" />
                <span className="text-muted-foreground">segundos</span>
              </div>
            </div>

            {/* ─── Quando ─── */}
            <div className="flex flex-col gap-2">
              <Label>Quando enviar?</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={mode === "now" ? "default" : "outline"}
                  disabled={isPending} onClick={() => setMode("now")}>Agora</Button>
                <Button type="button" size="sm" variant={mode === "scheduled" ? "default" : "outline"}
                  disabled={isPending} onClick={() => setMode("scheduled")}>Agendar</Button>
              </div>
              {mode === "scheduled" && (
                <Input name="scheduledFor" type="datetime-local" required disabled={isPending} className="h-9" />
              )}
            </div>

            {state.error && (
              <div className="flex items-start gap-2 text-sm text-red-500">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <Button type="submit" disabled={isPending || messages.length === 0 || selected.size === 0}>
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {mode === "scheduled" ? "Agendar disparo" : "Criar e enviar"}
            </Button>
          </div>

          {/* ─── Variáveis + prévia ─── */}
          <aside className="flex flex-col gap-3 min-w-0">
            <div className="border rounded-md p-3">
              <p className="text-xs font-medium mb-2">Variáveis</p>
              <div className="flex flex-col gap-1.5">
                {BROADCAST_VARIABLES.map((variable) => (
                  <button key={variable.token} type="button" disabled={isPending}
                    onClick={() => navigator.clipboard?.writeText(variable.token)}
                    className="text-left text-xs rounded px-2 py-1 hover:bg-accent">
                    <code className="text-primary">{variable.token}</code>
                    <span className="text-muted-foreground"> — {variable.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Clique para copiar e cole no texto da mensagem.
              </p>
            </div>

            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium mb-2">
                Prévia {preview.client ? `— ${preview.client.name}` : ""}
              </p>
              <div className="flex flex-col gap-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground">Adicione mensagens para visualizar aqui.</p>
                )}
                {messages.map((message) => (
                  <div key={message.key} className="rounded-lg bg-background border px-2.5 py-2 text-xs">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {TYPE_META[message.type].label}
                    </span>
                    {message.fileName && (
                      <div className="text-[10px] text-muted-foreground truncate">{message.fileName}</div>
                    )}
                    <div className="whitespace-pre-wrap break-words mt-0.5">
                      {message.text ? applyVariables(message.text, preview.context) : <span className="text-muted-foreground">—</span>}
                    </div>
                    {message.type === "poll" && (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {message.choices.filter((c) => c.trim()).map((choice, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">◦ {applyVariables(choice, preview.context)}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}
