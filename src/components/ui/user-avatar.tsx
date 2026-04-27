import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1","#f59e0b","#10b981","#ec4899","#3b82f6",
  "#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316",
];

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  bgColor?: string | null;
  ring?: boolean;
}

export function UserAvatar({ name, src, size = 32, className, bgColor, ring }: UserAvatarProps) {
  const px = `${size}px`;
  const fontSize = Math.max(10, Math.round(size * 0.4));
  const bg = bgColor ?? colorFor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        title={name}
        className={cn(
          "rounded-full object-cover shrink-0",
          ring && "border-2 border-white shadow-sm",
          className,
        )}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      title={name}
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shrink-0",
        ring && "border-2 border-white shadow-sm",
        className,
      )}
      style={{ width: px, height: px, backgroundColor: bg, fontSize: `${fontSize}px` }}
    >
      {getInitials(name)}
    </div>
  );
}
