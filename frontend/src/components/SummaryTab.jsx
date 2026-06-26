import { useState } from 'react'
import CoverageInfo from './CoverageInfo'
import LoadingPanel from './LoadingPanel'

export default function SummaryTab({ data, loading, error }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!data?.summary) return
    const concepts = data.key_concepts?.length
      ? `\n\nKey concepts: ${data.key_concepts.join(', ')}`
      : ''
    const text = `${data.summary}${concepts}`

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  if (loading) return <LoadingPanel type="summary" />

  if (error) {
    return (
      <div className="rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CoverageInfo coverage={data.coverage} />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          {copied ? 'Copied!' : 'Copy summary'}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200 sm:text-base">
          {data.summary}
        </p>
      </div>

      {data.key_concepts?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-400">Key concepts</h3>
          <div className="flex flex-wrap gap-2">
            {data.key_concepts.map((concept) => (
              <span
                key={concept}
                className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-sm text-zinc-200"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
