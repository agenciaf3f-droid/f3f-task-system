export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 bg-neutral-200 rounded-lg" />
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 bg-neutral-100 rounded w-2/3" />
              <div className="h-3 bg-neutral-100 rounded w-1/3" />
            </div>
            <div className="h-3 w-20 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
