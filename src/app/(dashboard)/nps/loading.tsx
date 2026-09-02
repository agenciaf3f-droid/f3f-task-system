export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-8">
      <div className="h-8 w-44 rounded-lg bg-neutral-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl border border-neutral-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
