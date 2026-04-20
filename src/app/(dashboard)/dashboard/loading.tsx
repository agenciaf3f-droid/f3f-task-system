export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-52 bg-neutral-200 rounded-lg" />
          <div className="h-4 w-32 bg-neutral-100 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-100" />
            <div className="flex flex-col gap-1.5">
              <div className="h-8 w-12 bg-neutral-100 rounded" />
              <div className="h-3 w-20 bg-neutral-100 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-neutral-100" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-48 bg-white rounded-2xl border border-neutral-100" />
          <div className="h-56 bg-white rounded-2xl border border-neutral-100" />
        </div>
      </div>
    </div>
  );
}
