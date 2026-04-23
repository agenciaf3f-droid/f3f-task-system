"use client";

import { useRef, useState, useTransition } from "react";
import { updateAvatarAction, removeAvatarAction } from "./actions";
import { Camera, Trash2, Loader2 } from "lucide-react";

interface AvatarUploadProps {
  currentAvatar: string | null;
  userName: string;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function AvatarUpload({ currentAvatar, userName }: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setError("Imagem deve ter no máximo 3MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Selecione apenas imagens (JPG, PNG, WebP).");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      const result = await updateAvatarAction(formData);
      if (result.error) {
        setError(result.error);
        setPreview(currentAvatar);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeAvatarAction();
      setPreview(null);
      setError(null);
    });
  }

  return (
    <div className="flex items-center gap-5">
      {/* Avatar preview */}
      <div className="relative shrink-0">
        {preview ? (
          <img
            src={preview}
            alt={userName}
            className="w-20 h-20 rounded-full object-cover border-2 border-neutral-200"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold border-2 border-blue-300">
            {getInitials(userName)}
          </div>
        )}
        {isPending && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          disabled={isPending}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-neutral-900 text-white rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          <Camera className="w-4 h-4" />
          {preview ? "Trocar foto" : "Adicionar foto"}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remover foto
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-xs text-neutral-400">JPG, PNG ou WebP — máx. 3MB</p>
      </div>
    </div>
  );
}
