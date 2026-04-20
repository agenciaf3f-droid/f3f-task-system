export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse max-w-2xl">
      <div className="h-8 w-44 bg-neutral-200 rounded-lg" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
          <div className="h-4 w-40 bg-neutral-200 rounded" />
          <div className="h-9 bg-neutral-100 rounded-lg" />
          <div className="h-9 bg-neutral-100 rounded-lg" />
          <div className="h-9 w-28 bg-neutral-200 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
