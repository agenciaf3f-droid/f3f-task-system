export default function TarefaDetailLoading() {
  return (
    <div className="max-w-3xl flex flex-col gap-6 animate-pulse">
      <div className="h-4 w-24 bg-neutral-100 rounded" />
      <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-6 w-3/4 bg-neutral-100 rounded" />
            <div className="h-4 w-1/2 bg-neutral-100 rounded" />
          </div>
          <div className="h-8 w-24 bg-neutral-100 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 w-20 bg-neutral-100 rounded" />
              <div className="h-5 w-28 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
        <div className="h-2 w-full bg-neutral-100 rounded-full" />
      </div>
      <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-3">
        <div className="h-4 w-24 bg-neutral-100 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-4 h-4 rounded bg-neutral-100" />
            <div className="h-4 flex-1 bg-neutral-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
