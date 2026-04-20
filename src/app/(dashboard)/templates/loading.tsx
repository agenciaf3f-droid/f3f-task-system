export default function TemplatesLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-28 bg-neutral-100 rounded-lg" />
          <div className="h-4 w-40 bg-neutral-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-neutral-100 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="h-4 w-36 bg-neutral-100 rounded" />
              <div className="h-5 w-14 bg-neutral-100 rounded-full" />
            </div>
            <div className="h-3 w-full bg-neutral-100 rounded" />
            <div className="flex gap-2 mt-1">
              <div className="h-3 w-20 bg-neutral-100 rounded" />
              <div className="h-3 w-16 bg-neutral-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
