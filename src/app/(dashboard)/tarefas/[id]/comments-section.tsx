"use client";

import { useState, useTransition, useRef } from "react";
import { addCommentAction } from "../actions";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  user: { name: string };
}

export function CommentsSection({
  taskId,
  comments,
  currentUserName,
}: {
  taskId: string;
  comments: Comment[];
  currentUserName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = textareaRef.current?.value.trim();
    if (!content) return;
    startTransition(async () => {
      await addCommentAction(taskId, content);
      if (textareaRef.current) textareaRef.current.value = "";
    });
  }

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-neutral-500" />
        Comentários{" "}
        {comments.length > 0 && (
          <span className="text-xs font-normal text-neutral-400">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* Comment list */}
      {comments.length > 0 && (
        <div className="flex flex-col gap-4 mb-5">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-semibold text-neutral-600 shrink-0 mt-0.5">
                {initials(comment.user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-neutral-900">
                    {comment.user.name.split(" ")[0]}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {formatDistanceToNow(comment.createdAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-[11px] font-semibold text-neutral-600 shrink-0 mt-0.5">
          {initials(currentUserName)}
        </div>
        <div className="flex-1 flex gap-2">
          <textarea
            ref={textareaRef}
            placeholder="Escreva um comentário..."
            rows={2}
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isPending}
            className="w-9 h-9 shrink-0"
            title="Enviar (Cmd+Enter)"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>
      <p className="text-xs text-neutral-400 mt-1.5 ml-10">
        Cmd+Enter para enviar
      </p>
    </div>
  );
}
