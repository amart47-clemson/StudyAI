export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-zinc-800 ${className}`} />
}

export function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-4 w-48" />
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-4/6" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLine key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
    </div>
  )
}

export function FlashcardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="mx-auto h-4 w-20" />
      <SkeletonLine className="mx-auto h-56 w-full max-w-lg rounded-xl sm:h-64" />
      <div className="flex justify-center gap-4">
        <SkeletonLine className="h-10 w-24 rounded-lg" />
        <SkeletonLine className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  )
}

export function QuizSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="mx-auto h-4 w-32" />
      <SkeletonLine className="h-6 w-full max-w-md" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLine key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
