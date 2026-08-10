export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-36 bg-neutral-200 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-100" />
            <div className="h-7 w-16 bg-neutral-200 rounded" />
            <div className="h-3 w-24 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-6 h-64" />
        ))}
      </div>
    </div>
  );
}
