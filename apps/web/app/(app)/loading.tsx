export default function Loading() {
  return (
    <div className="flex flex-col gap-3 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded border bg-muted" />
      ))}
    </div>
  );
}
