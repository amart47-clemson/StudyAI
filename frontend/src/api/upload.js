import { API_BASE } from './config'

export async function uploadDocument({ file, text }) {
  let response

  if (file) {
    const formData = new FormData()
    formData.append('file', file)
    response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
  } else {
    response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  }

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export async function loadDemoDocument() {
  const response = await fetch(`${API_BASE}/demo`, { method: 'POST' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to load demo')
  return data
}

export async function lookupDocuments(docIds) {
  const response = await fetch(`${API_BASE}/documents/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_ids: docIds }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Lookup failed')
  return data.documents ?? []
}
