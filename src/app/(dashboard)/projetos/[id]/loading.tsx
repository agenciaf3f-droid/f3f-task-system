export default function ProjetoDetailLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl animate-pulse">
      <div className="h-4 w-32 bg-neutral-100 rounded" />
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-20 bg-neutral-100 rounded" />
              <div className="h-5 w-48 bg-neutral-100 rounded" />
            </div>
          </div>
          <div className="h-9 w-28 bg-neutral-100 rounded-lg" />
        </div>
        <div className="mt-5 pt-5 border-t border-neutral-100">
          <div className="flex justify-between mb-2">
            <div className="h-3 w-32 bg-neutral-100 rounded" />
            <div className="h-5 w-10 bg-neutral-100 rounded" />
          </div>
          <div className="h-3 w-full bg-neutral-100 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 bg-white border border-neutral-200 rounded-lg px-4 py-3">
            <div className="w-1 h-10 bg-neutral-100 rounded-full" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-4 w-56 bg-neutral-100 rounded" />
              <div className="h-3 w-32 bg-neutral-100 rounded" />
            </div>
            <div className="h-5 w-20 bg-neutral-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
