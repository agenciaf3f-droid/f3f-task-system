export default function TarefasLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-24 bg-neutral-200 rounded-lg" />
          <div className="h-4 w-16 bg-neutral-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-neutral-100 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-neutral-100 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-3">
            <div className="w-1 h-10 bg-neutral-100 rounded-full" />
            <div className="w-4 h-4 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-4 bg-neutral-100 rounded" style={{ width: `${40 + (i * 7) % 40}%` }} />
              <div className="h-3 w-28 bg-neutral-100 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-neutral-100 rounded-full" />
              <div className="h-5 w-12 bg-neutral-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
