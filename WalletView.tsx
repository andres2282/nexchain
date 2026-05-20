export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-nex-panel ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function TokenRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-nex-panel border border-white/5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-2 w-20" />
        </div>
      </div>
      <div className="space-y-1 text-right">
        <Skeleton className="h-3 w-14 ml-auto" />
        <Skeleton className="h-2 w-10 ml-auto" />
      </div>
    </div>
  );
}
