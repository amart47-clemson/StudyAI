import { API_BASE } from './config'

export async function generateContent(docId, type, options = {}) {
  const body = { doc_id: docId, type }

  if (options.count != null) body.count = options.count
  if (options.format != null) body.format = options.format
  if (options.difficulty != null) body.difficulty = options.difficulty
  if (options.topic_filter != null) body.topic_filter = options.topic_filter
  if (options.mix != null) body.mix = options.mix
  if (options.adaptive != null) body.adaptive = options.adaptive

  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Generation failed')
  }

  return data
}
