export default function Toast({ message }) {
  if (!message) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 shadow-lg">
      {message}
    </div>
  )
}
