export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />
}

export function SummarySkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonLine className="h-4 w-48" />
      <div
        className="space-y-3 p-6"
        style={{
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
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
      <SkeletonLine className="mx-auto h-56 w-full max-w-lg rounded-[18px] sm:h-64" />
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
          <SkeletonLine key={i} className="h-14 w-full rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}
