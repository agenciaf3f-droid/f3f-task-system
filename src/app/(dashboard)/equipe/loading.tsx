export default function EquipeLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-24 bg-neutral-100 rounded-lg" />
          <div className="h-4 w-32 bg-neutral-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-neutral-100 rounded-lg" />
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-4 w-40 bg-neutral-100 rounded" />
              <div className="h-3 w-48 bg-neutral-100 rounded" />
            </div>
            <div className="h-5 w-16 bg-neutral-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
