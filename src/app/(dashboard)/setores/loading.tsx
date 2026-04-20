export default function SetoresLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-24 bg-neutral-100 rounded-lg" />
          <div className="h-4 w-20 bg-neutral-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-neutral-100 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neutral-100" />
              <div className="h-4 w-32 bg-neutral-100 rounded" />
            </div>
            <div className="h-3 w-full bg-neutral-100 rounded" />
            <div className="flex gap-4">
              <div className="h-3 w-20 bg-neutral-100 rounded" />
              <div className="h-3 w-24 bg-neutral-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
