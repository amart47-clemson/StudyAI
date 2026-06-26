const STORAGE_KEY = 'studyai_recent_docs'
const MAX_RECENT = 5

export function addRecentDocument({ docId, filename, uploadTime }) {
  const existing = getRecentDocIds()
    .map((id) => getStoredEntry(id))
    .filter(Boolean)

  const entry = {
    docId,
    filename: filename || 'Untitled document',
    uploadTime: uploadTime || new Date().toISOString(),
  }

  const filtered = existing.filter((item) => item.docId !== docId)
  const updated = [entry, ...filtered].slice(0, MAX_RECENT)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

function getStoredEntry(docId) {
  const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  return items.find((item) => item.docId === docId) ?? null
}

export function getRecentDocuments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function getRecentDocIds() {
  return getRecentDocuments().map((item) => item.docId)
}
