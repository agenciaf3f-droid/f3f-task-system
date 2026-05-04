"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Trash2, Download, Loader2, Upload } from "lucide-react";
import { uploadAttachmentAction, deleteAttachmentAction, getAttachmentSignedUrlAction } from "../attachment-actions";

type Attachment = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  user: { name: string };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({
  taskId,
  initialAttachments,
  canEdit,
}: {
  taskId: string;
  initialAttachments: Attachment[];
  canEdit: boolean;
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      const result = await uploadAttachmentAction(taskId, fd);
      if (result.error) {
        setUploadError(result.error);
      } else {
        // Re-fetch handled by revalidatePath — optimistic UI workaround:
        // the server revalidates and the page re-renders with new data
      }
    });
    // Reset input so the same file can be re-uploaded after delete
    e.target.value = "";
  }

  function handleDelete(attachmentId: string) {
    startTransition(async () => {
      const result = await deleteAttachmentAction(attachmentId);
      if (!result.error) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      }
    });
  }

  async function handleDownload(attachmentId: string, fileName: string) {
    const result = await getAttachmentSignedUrlAction(attachmentId);
    if (result.url) {
      const a = document.createElement("a");
      a.href = result.url;
      a.download = fileName;
      a.click();
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">
            Anexos {attachments.length > 0 && <span className="text-neutral-400">({attachments.length})</span>}
          </h2>
        </div>
        {canEdit && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Enviar arquivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
            />
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-600 mb-3">{uploadError}</p>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum anexo ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 group">
              <Paperclip className="w-4 h-4 text-neutral-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-900 truncate">{a.fileName}</p>
                <p className="text-xs text-neutral-400">{formatBytes(a.fileSize)} · {a.user.name.split(" ")[0]}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDownload(a.id, a.fileName)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors"
                  title="Baixar"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={isPending}
                    className="p-1 text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
