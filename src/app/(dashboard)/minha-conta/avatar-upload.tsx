"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Crop, Loader2, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { updateAvatarAction, removeAvatarAction } from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvatarUploadProps {
  currentAvatar: string | null;
  userName: string;
}

type Point = { x: number; y: number };
type ImageSize = { width: number; height: number };

const CROP_SIZE = 320;
const OUTPUT_SIZE = 512;
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function getBaseScale(imageSize: ImageSize) {
  return Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height);
}

function clampOffset(offset: Point, imageSize: ImageSize, zoom: number): Point {
  const baseScale = getBaseScale(imageSize);
  const maxX = Math.max(0, (imageSize.width * baseScale * zoom - CROP_SIZE) / 2);
  const maxY = Math.max(0, (imageSize.height * baseScale * zoom - CROP_SIZE) / 2);

  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível recortar a imagem.")),
      "image/webp",
      0.92,
    );
  });
}

export function AvatarUpload({ currentAvatar, userName }: AvatarUploadProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropOpen, setCropOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);

  function resetCrop() {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  }

  function closeCropEditor() {
    if (isPending) return;
    setCropOpen(false);
    setCropSource(null);
    setImageSize(null);
    resetCrop();
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("Imagem deve ter no máximo 3MB.");
      event.target.value = "";
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Selecione uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }

    setError(null);
    resetCrop();
    const reader = new FileReader();
    reader.onload = () => {
      setCropSource(String(reader.result));
      setCropOpen(true);
    };
    reader.onerror = () => setError("Não foi possível abrir essa imagem.");
    reader.readAsDataURL(file);
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setImageSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageSize || isPending) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: offset,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !imageSize) return;

    setOffset(clampOffset({
      x: drag.origin.x + event.clientX - drag.start.x,
      y: drag.origin.y + event.clientY - drag.start.y,
    }, imageSize, zoom));
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  function handleCropKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!imageSize || isPending || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 12 : 4;
    const movement: Record<string, Point> = {
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
    };
    const delta = movement[event.key];
    setOffset((current) => clampOffset({ x: current.x + delta.x, y: current.y + delta.y }, imageSize, zoom));
  }

  function handleZoomChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextZoom = Number(event.target.value);
    setZoom(nextZoom);
    if (imageSize) setOffset((current) => clampOffset(current, imageSize, nextZoom));
  }

  async function createCroppedFile() {
    const image = imageRef.current;
    if (!image || !imageSize) throw new Error("A imagem ainda não está pronta.");

    const baseScale = getBaseScale(imageSize);
    const displayedWidth = imageSize.width * baseScale * zoom;
    const displayedHeight = imageSize.height * baseScale * zoom;
    const imageLeft = CROP_SIZE / 2 - displayedWidth / 2 + offset.x;
    const imageTop = CROP_SIZE / 2 - displayedHeight / 2 + offset.y;
    const sourceX = Math.max(0, -imageLeft / displayedWidth * imageSize.width);
    const sourceY = Math.max(0, -imageTop / displayedHeight * imageSize.height);
    const sourceWidth = Math.min(imageSize.width - sourceX, CROP_SIZE / displayedWidth * imageSize.width);
    const sourceHeight = Math.min(imageSize.height - sourceY, CROP_SIZE / displayedHeight * imageSize.height);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    const blob = await canvasToBlob(canvas);
    return new File([blob], "avatar.webp", { type: "image/webp" });
  }

  function handleCropConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const croppedFile = await createCroppedFile();
        const formData = new FormData();
        formData.append("avatar", croppedFile);
        const result = await updateAvatarAction(formData);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (result.avatarUrl) setPreview(result.avatarUrl);
        setCropOpen(false);
        setCropSource(null);
        setImageSize(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Erro ao recortar a imagem.");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreview(null);
      setError(null);
      router.refresh();
    });
  }

  const baseScale = imageSize ? getBaseScale(imageSize) : 1;

  return (
    <>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          {preview ? (
            <img src={preview} alt={userName} className="w-20 h-20 rounded-full object-cover border-2 border-neutral-200" />
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

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
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
          {error && !cropOpen && <p className="text-xs text-red-500 max-w-64">{error}</p>}
          <p className="text-xs text-neutral-400">JPG, PNG ou WebP — máx. 3MB</p>
        </div>
      </div>

      <Dialog open={cropOpen} onOpenChange={(open) => { if (!open) closeCropEditor(); }}>
        <DialogContent className="sm:max-w-md p-6 gap-5" showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Crop className="w-5 h-5 text-blue-600" />
              Ajustar foto de perfil
            </DialogTitle>
            <DialogDescription>Arraste a imagem para escolher a região e use o zoom para ajustar o enquadramento.</DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <div
              role="group"
              aria-label="Área de enquadramento da foto. Arraste ou use as setas do teclado para reposicionar."
              tabIndex={0}
              className="relative overflow-hidden rounded-2xl bg-neutral-100 shadow-inner cursor-grab active:cursor-grabbing touch-none select-none"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
              onKeyDown={handleCropKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              {cropSource && (
                <img
                  ref={imageRef}
                  src={cropSource}
                  alt="Imagem selecionada para recorte"
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                  style={imageSize ? {
                    width: imageSize.width * baseScale,
                    height: imageSize.height * baseScale,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  } : undefined}
                />
              )}
              <div className="absolute inset-0 rounded-full border-[3px] border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)] pointer-events-none" />
              {!imageSize && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={handleZoomChange}
              disabled={!imageSize || isPending}
              aria-label="Zoom da foto"
              className="w-full accent-blue-600"
            />
            <button
              type="button"
              onClick={resetCrop}
              disabled={!imageSize || isPending}
              title="Centralizar imagem"
              aria-label="Centralizar imagem"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && cropOpen && <p className="text-xs text-red-500">{error}</p>}

          <DialogFooter className="-mx-6 -mb-6 px-6">
            <button
              type="button"
              onClick={closeCropEditor}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCropConfirm}
              disabled={!imageSize || isPending}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crop className="w-4 h-4" />}
              Salvar enquadramento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
