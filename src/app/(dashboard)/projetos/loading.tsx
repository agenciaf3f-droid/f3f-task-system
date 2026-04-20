export default function ProjetosLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-32 bg-neutral-200 rounded-lg" />
          <div className="h-4 w-48 bg-neutral-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-neutral-100 rounded-lg" />
      </div>
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-neutral-200 shrink-0" />
            <div className="flex flex-col gap-1">
              <div className="h-4 w-32 bg-neutral-200 rounded" />
              <div className="h-3 w-20 bg-neutral-100 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-4 w-40 bg-neutral-100 rounded" />
                    <div className="h-3 w-28 bg-neutral-100 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-neutral-100 rounded-full" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <div className="h-3 w-16 bg-neutral-100 rounded" />
                    <div className="h-3 w-8 bg-neutral-100 rounded" />
                  </div>
                  <div className="h-1.5 w-full bg-neutral-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
