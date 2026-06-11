"use client";

import { useState, useTransition, useRef } from "react";
import { addCommentAction, editCommentAction } from "../actions";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2, Pencil, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Linkify } from "@/components/ui/linkify";

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  isEdited?: boolean;
  userId: string;
  user: { name: string };
}

interface MentionUser { id: string; name: string }

const MENTION_RE = /@\[([^\]]+)\]\([^)]+\)/g;

function renderContent(content: string) {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^@\[([^\]]+)\]\([^)]+\)$/);
    if (m) return <span key={i} className="text-blue-600 font-medium">@{m[1]}</span>;
    return <Linkify key={i} text={part} />;
  });
}

function MentionTextarea({
  users,
  onSubmit,
  isPending,
}: {
  users: MentionUser[];
  onSubmit: (content: string) => void;
  isPending: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [picker, setPicker] = useState<{ query: string; atIndex: number } | null>(null);

  const filtered = picker
    ? users.filter((u) => u.name.toLowerCase().includes(picker.query.toLowerCase())).slice(0, 6)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setValue(val);

    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@([^\s@]*)$/);
    if (atMatch) {
      setPicker({ query: atMatch[1], atIndex: before.lastIndexOf("@") });
    } else {
      setPicker(null);
    }
  }

  function insertMention(u: MentionUser) {
    if (!picker) return;
    const before = value.slice(0, picker.atIndex);
    const after = value.slice((textareaRef.current?.selectionStart ?? picker.atIndex) );
    const mention = `@[${u.name}](${u.id})`;
    const newVal = `${before}${mention} ${after}`;
    setValue(newVal);
    setPicker(null);
    textareaRef.current?.focus();
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    setPicker(null);
  }

  return (
    <div className="flex-1 flex gap-2 relative">
      {picker && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-52 z-20">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder="Escreva um comentário... (@Nome para mencionar)"
        rows={2}
        disabled={isPending}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setPicker(null); return; }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none"
      />
      <Button
        type="button"
        size="icon"
        disabled={isPending || !value.trim()}
        onClick={handleSubmit}
        className="w-9 h-9 shrink-0"
        title="Enviar (Cmd+Enter)"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
}: {
  comment: Comment;
  canEdit: boolean;
}) {
  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.content) { setEditing(false); return; }
    startTransition(async () => {
      await editCommentAction(comment.id, trimmed);
      setEditing(false);
    });
  }

  return (
    <div className="flex items-start gap-3 group/c">
      <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-semibold text-neutral-600 shrink-0 mt-0.5">
        {initials(comment.user.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-neutral-900">
            {comment.user.name.split(" ")[0]}
          </span>
          <span className="text-xs text-neutral-400">
            {formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: ptBR })}
          </span>
          {comment.isEdited && <span className="text-xs text-neutral-300">(editado)</span>}
          {canEdit && !editing && (
            <button
              onClick={() => { setDraft(comment.content); setEditing(true); }}
              className="ml-auto opacity-0 group-hover/c:opacity-100 transition-opacity text-neutral-400 hover:text-neutral-700"
              title="Editar comentário"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex items-start gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setEditing(false); setDraft(comment.content); }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
              }}
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={save} disabled={isPending} className="p-1 rounded bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50" title="Salvar (Cmd+Enter)">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setEditing(false); setDraft(comment.content); }} disabled={isPending} className="p-1 rounded text-neutral-500 hover:bg-neutral-100" title="Cancelar">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
            {renderContent(comment.content)}
          </p>
        )}
      </div>
    </div>
  );
}

export function CommentsSection({
  taskId,
  comments,
  currentUserName,
  currentUserId,
  canModerate = false,
  users = [],
}: {
  taskId: string;
  comments: Comment[];
  currentUserName: string;
  currentUserId?: string;
  canModerate?: boolean;
  users?: MentionUser[];
}) {
  const [isPending, startTransition] = useTransition();

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function handleSubmit(content: string) {
    startTransition(async () => {
      await addCommentAction(taskId, content);
    });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-neutral-500" />
        Comentários{" "}
        {comments.length > 0 && (
          <span className="text-xs font-normal text-neutral-400">({comments.length})</span>
        )}
      </h2>

      {comments.length > 0 && (
        <div className="flex flex-col gap-4 mb-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canEdit={canModerate || comment.userId === currentUserId}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-semibold text-neutral-600 shrink-0 mt-0.5">
          {initials(currentUserName)}
        </div>
        <MentionTextarea users={users} onSubmit={handleSubmit} isPending={isPending} />
      </div>
      <p className="text-xs text-neutral-400 mt-1.5 ml-10">Cmd+Enter para enviar · @ para mencionar</p>
    </div>
  );
}
