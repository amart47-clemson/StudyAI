import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadDemoDocument, lookupDocuments, uploadDocument } from '../api/upload'
import { useDocument } from '../context/DocumentContext'
import { addRecentDocument, getRecentDocuments } from '../utils/documentHistory'

const FEATURES = [
  { label: 'AI Flashcards', icon: '🃏' },
  { label: 'Adaptive Quiz', icon: '✓' },
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:gap-12 lg:py-16">
        <div className="flex-1">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            StudyAI
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Turn any document into a complete study session — instantly
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Upload a PDF or paste notes and get AI-generated summaries, flashcards,
            quizzes, and a chat assistant grounded in your material.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {FEATURES.map((feature) => (
              <span
                key={feature.label}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300"
              >
                <span aria-hidden="true">{feature.icon}</span>
                {feature.label}
              </span>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1 shadow-2xl backdrop-blur">
            <div className="flex rounded-xl bg-zinc-950/50 p-1">
              <button
                type="button"
                onClick={() => setMode('file')}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === 'file'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  mode === 'text'
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
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
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 transition-colors sm:py-16 ${
                    isDragging
                      ? 'border-violet-500 bg-violet-950/20'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-zinc-800 text-xl">
                    📄
                  </div>
                  <p className="text-sm font-medium text-zinc-200">
                    Drag and drop a PDF here
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">or tap to browse</p>
                  <label className="mt-4 cursor-pointer rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100">
                    Choose file
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    />
                  </label>
                  {file && (
                    <p className="mt-4 max-w-full truncate px-4 text-sm text-violet-300">
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
                  className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              )}

              {error && (
                <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || demoLoading}
                className="w-full rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Processing your document…' : 'Start studying →'}
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-zinc-800" />
                <span className="px-3 text-xs text-zinc-600">or</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>

              <button
                type="button"
                onClick={handleDemo}
                disabled={loading || demoLoading}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {demoLoading ? 'Loading sample…' : '✨ Try a sample document'}
              </button>
            </form>
          </div>
        </div>

        {recentDocs.length > 0 && (
          <aside className="w-full shrink-0 lg:w-72">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur">
              <h2 className="text-sm font-semibold text-zinc-300">Recent documents</h2>
              <p className="mt-1 text-xs text-zinc-500">Pick up where you left off</p>
              <ul className="mt-4 space-y-2">
                {recentDocs.map((doc) => (
                  <li key={doc.docId}>
                    <button
                      type="button"
                      onClick={() => navigate(`/study/${doc.docId}`)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
                    >
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {doc.filename}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
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
