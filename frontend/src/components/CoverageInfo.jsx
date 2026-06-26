export default function CoverageInfo({ coverage, cappedAt, itemLabel }) {
  if (!coverage) return null

  const chars = coverage.characters_processed?.toLocaleString() ?? '0'
  const chunkCount = coverage.total_chunks ?? coverage.chunks_used ?? 0
  const sampled =
    coverage.chunks_used != null &&
    coverage.total_chunks != null &&
    coverage.chunks_used < coverage.total_chunks

  return (
    <div className="space-y-1 border-b border-zinc-800 pb-4 text-xs text-zinc-500">
      <p>
        Generated from {chars} characters across {chunkCount} document chunk
        {chunkCount === 1 ? '' : 's'}
        {sampled ? ` (${coverage.chunks_used} evenly sampled)` : ''}
      </p>
      {cappedAt != null && itemLabel && (
        <p>
          Capped at {cappedAt} {itemLabel} based on document length
        </p>
      )}
    </div>
  )
}
