import { API_BASE } from './config'

function networkError() {
  return new Error(
    `Cannot reach API at ${API_BASE}. On Vercel, set VITE_API_URL to your Render URL and redeploy. On Render, add your Vercel URL to CORS_ORIGINS.`,
  )
}

async function parseJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`API returned an invalid response (${response.status})`)
  }
}

export async function uploadDocument({ file, text }) {
  let response

  try {
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
  } catch {
    throw networkError()
  }

  const data = await parseJson(response)
  if (!response.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export async function loadDemoDocument() {
  let response

  try {
    response = await fetch(`${API_BASE}/demo`, { method: 'POST' })
  } catch {
    throw networkError()
  }

  const data = await parseJson(response)
  if (!response.ok) throw new Error(data.error || 'Failed to load demo')
  return data
}

export async function lookupDocuments(docIds) {
  let response

  try {
    response = await fetch(`${API_BASE}/documents/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_ids: docIds }),
    })
  } catch {
    throw networkError()
  }

  const data = await parseJson(response)
  if (!response.ok) throw new Error(data.error || 'Lookup failed')
  return data.documents ?? []
}
