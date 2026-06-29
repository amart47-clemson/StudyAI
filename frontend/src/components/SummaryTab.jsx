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
      <div
        className="rounded-lg px-4 py-3 text-sm"
        style={{
          background: 'rgba(239, 68, 68, 0.12)',
          color: 'var(--danger)',
        }}
      >
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
          className="btn-ghost shrink-0 !w-auto px-3 py-1.5 text-xs"
        >
          {copied ? 'Copied!' : 'Copy summary'}
        </button>
      </div>

      <div className="surface-elevated p-4 sm:p-6">
        <p
          className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base"
          style={{ color: 'var(--text-primary)' }}
        >
          {data.summary}
        </p>
      </div>

      {data.key_concepts?.length > 0 && (
        <div>
          <h3
            className="mb-3 text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Key concepts
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.key_concepts.map((concept) => (
              <span
                key={concept}
                className="feature-pill text-sm"
                style={{ padding: '0.375rem 0.875rem' }}
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
