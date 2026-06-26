export default function Spinner({ className = '' }) {
  return (
    <div
      className={`size-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300 ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
