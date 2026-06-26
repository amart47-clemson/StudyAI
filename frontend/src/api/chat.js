import { API_BASE } from './config'

export async function sendChat(docId, message, history) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_id: docId,
      message,
      history,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Chat request failed')
  }

  return data
}
