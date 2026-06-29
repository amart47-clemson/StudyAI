export default function CoverageInfo({ coverage }) {
  if (!coverage) return null

  const chars = coverage.characters_processed?.toLocaleString() ?? '0'
  const chunkCount = coverage.total_chunks ?? coverage.chunks_used ?? 0
  const sampled =
    coverage.chunks_used != null &&
    coverage.total_chunks != null &&
    coverage.chunks_used < coverage.total_chunks

  return (
    <div
      className="border-b pb-4 text-xs"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    >
      <p>
        Generated from {chars} characters across {chunkCount} document chunk
        {chunkCount === 1 ? '' : 's'}
        {sampled ? ` (${coverage.chunks_used} evenly sampled)` : ''}
      </p>
    </div>
  )
}
