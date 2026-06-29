import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadDemoDocument, lookupDocuments, uploadDocument } from '../api/upload'
import { useDocument } from '../context/DocumentContext'
import { addRecentDocument, getRecentDocuments } from '../utils/documentHistory'

const FEATURES = [
  { label: 'AI Flashcards', icon: '🃏' },
  { label: 'Adaptive Quiz', icon: '🧠' },
  { label: 'Document Chat', icon: '💬' },
]

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function UploadIcon() {
  return (
    <svg
      className="mx-auto mb-4"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { setDocument } = useDocument()

  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentDocs, setRecentDocs] = useState([])

  useEffect(() => {
    async function loadRecent() {
      const local = getRecentDocuments()
      if (local.length === 0) {
        setRecentDocs([])
        return
      }

      try {
        const remote = await lookupDocuments(local.map((d) => d.docId))
        const merged = local.map((item) => {
          const meta = remote.find((r) => r.doc_id === item.docId)
          return {
            ...item,
            filename: meta?.filename ?? item.filename,
            uploadTime: meta?.upload_time ?? item.uploadTime,
          }
        })
        setRecentDocs(merged)
      } catch {
        setRecentDocs(local)
      }
    }

    loadRecent()
  }, [])

  function handleFileSelect(selected) {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported')
      setFile(null)
      return
    }
    setError('')
    setFile(selected)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    handleFileSelect(event.dataTransfer.files[0])
  }

  async function finishUpload(data) {
    setDocument({ docId: data.doc_id, text: data.text })
    addRecentDocument({
      docId: data.doc_id,
      filename: data.filename ?? 'Untitled document',
      uploadTime: new Date().toISOString(),
    })
    navigate(`/study/${data.doc_id}`)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (mode === 'file' && !file) {
      setError('Please select a PDF file')
      return
    }
    if (mode === 'text' && !text.trim()) {
      setError('Please paste some text')
      return
    }

    setLoading(true)
    try {
      const data = await uploadDocument({
        file: mode === 'file' ? file : null,
        text: mode === 'text' ? text : null,
      })
      await finishUpload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemo() {
    setError('')
    setDemoLoading(true)
    try {
      const data = await loadDemoDocument()
      await finishUpload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="landing-bg page-enter min-h-screen">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:gap-12 lg:py-16">
        <div className="flex-1">
          <p
            className="text-sm font-semibold tracking-[0.2em]"
            style={{ color: 'var(--accent)' }}
          >
            <span aria-hidden="true">🧠 </span>
            STUDYAI
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span style={{ color: 'var(--text-primary)' }}>
              Turn any document into a complete study session —{' '}
            </span>
            <span className="gradient-text">instantly</span>
          </h1>
          <p
            className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: 'var(--text-secondary)' }}
          >
            Upload a PDF or paste notes and get AI-generated summaries, flashcards,
            quizzes, and a chat assistant grounded in your material.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {FEATURES.map((feature) => (
              <span key={feature.label} className="feature-pill">
                <span className="feature-pill-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                {feature.label}
              </span>
            ))}
          </div>

          <div
            className="mt-10 p-1 shadow-2xl"
            style={{
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
            }}
          >
            <div className="pill-toggle m-3 mb-0">
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`pill-toggle-btn ${mode === 'file' ? 'active' : ''}`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`pill-toggle-btn ${mode === 'text' ? 'active' : ''}`}
              >
                Paste text
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
              {mode === 'file' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`upload-zone flex flex-col items-center justify-center px-4 py-12 sm:py-16 ${
                    isDragging ? 'is-dragging' : ''
                  }`}
                >
                  <UploadIcon />
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Drag and drop a PDF here
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    or tap to browse
                  </p>
                  <label
                    className="mt-5 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-150"
                    style={{
                      background: 'var(--accent-glow)',
                      color: 'var(--accent)',
                      border: '1px solid var(--border-accent)',
                    }}
                  >
                    Choose file
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                  </label>
                  {file && (
                    <p
                      className="mt-4 max-w-full truncate px-4 text-sm"
                      style={{ color: 'var(--accent-secondary)' }}
                    >
                      {file.name}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your study material here..."
                  rows={8}
                  className="w-full resize-none px-4 py-3 text-sm focus:outline-none"
                  style={{
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                  }}
                />
              )}

              {error && (
                <p
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || demoLoading}
                className="btn-primary"
              >
                {loading ? 'Processing your document…' : 'Start studying →'}
              </button>

              <div className="relative flex items-center py-1">
                <div
                  className="flex-1 border-t"
                  style={{ borderColor: 'var(--border)' }}
                />
                <span
                  className="px-3 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  or
                </span>
                <div
                  className="flex-1 border-t"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <button
                type="button"
                onClick={handleDemo}
                disabled={loading || demoLoading}
                className="btn-ghost"
              >
                {demoLoading ? 'Loading sample…' : '✨ Try a sample document'}
              </button>
            </form>
          </div>
        </div>

        {recentDocs.length > 0 && (
          <aside className="w-full shrink-0 lg:w-72">
            <div className="surface-card p-5">
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Recent documents
              </h2>
              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                Pick up where you left off
              </p>
              <ul className="mt-4 space-y-2">
                {recentDocs.map((doc) => (
                  <li key={doc.docId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/study/${doc.docId}`)}
                      className="recent-doc-btn"
                    >
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {doc.filename}
                      </p>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatDate(doc.uploadTime)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
