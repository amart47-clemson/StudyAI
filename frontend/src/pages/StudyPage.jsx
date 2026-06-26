import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { generateContent } from '../api/generate'
import ChatTab from '../components/ChatTab'
import ErrorBoundary from '../components/ErrorBoundary'
import FlashcardsTab from '../components/FlashcardsTab'
import QuizTab from '../components/QuizTab'
import SummaryTab from '../components/SummaryTab'
import Toast from '../components/Toast'
import {
  dedupeByQuestion,
  getActionGenerateType,
  getActionToastMessage,
  isAppendAction,
} from '../utils/chatActions'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'chat', label: 'Chat' },
]

function formatLastUpdated(date) {
  if (!date) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function StudyPage() {
  const { docId } = useParams()
  const [activeTab, setActiveTab] = useState('summary')
  const [chatMessages, setChatMessages] = useState([])
  const [toast, setToast] = useState('')
  const [studyWeakLoading, setStudyWeakLoading] = useState(false)

  const [cache, setCache] = useState({
    summary: null,
    flashcards: null,
    quiz: null,
  })
  const [loading, setLoading] = useState({
    summary: false,
    flashcards: false,
    quiz: false,
  })
  const [errors, setErrors] = useState({
    summary: null,
    flashcards: null,
    quiz: null,
  })
  const [lastUpdated, setLastUpdated] = useState({
    summary: null,
    flashcards: null,
    quiz: null,
  })

  const fetched = useRef({ summary: false, flashcards: false, quiz: false })
  const toastTimer = useRef(null)

  const showToast = useCallback((message) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 4000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const markUpdated = useCallback((type) => {
    setLastUpdated((prev) => ({ ...prev, [type]: new Date() }))
  }, [])

  async function fetchType(type, options = {}) {
    const { count, format, difficulty, topic_filter } = options
    const isForced =
      count != null || format != null || difficulty != null || topic_filter != null

    if (!isForced && fetched.current[type]) return null

    if (!isForced) fetched.current[type] = true

    setLoading((prev) => ({ ...prev, [type]: true }))
    setErrors((prev) => ({ ...prev, [type]: null }))

    try {
      const data = await generateContent(docId, type, {
        count,
        format,
        difficulty,
        topic_filter,
      })
      setCache((prev) => ({ ...prev, [type]: data }))
      markUpdated(type)
      return data
    } catch (err) {
      if (!isForced) fetched.current[type] = false
      setErrors((prev) => ({
        ...prev,
        [type]: err instanceof Error ? err.message : 'Generation failed',
      }))
      throw err
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }))
    }
  }

  const handleChatAction = useCallback(
    async (action) => {
      const type = getActionGenerateType(action.type)
      const options = {
        count: action.count,
        format: action.format,
        difficulty: action.difficulty,
        topic_filter: action.topic_filter,
      }

      if (isAppendAction(action.type)) {
        setLoading((prev) => ({ ...prev, [type]: true }))
        setErrors((prev) => ({ ...prev, [type]: null }))

        try {
          const data = await generateContent(docId, type, options)
          const itemsKey = type === 'quiz' ? 'questions' : 'flashcards'
          const incoming = data[itemsKey] ?? []

          let appendResult = { addedCount: 0, totalCount: 0, cappedAt: data.capped_at }

          setCache((prev) => {
            const existing = prev[type]?.[itemsKey] ?? []
            const merged = dedupeByQuestion(existing, incoming)
            appendResult = {
              addedCount: merged.length,
              totalCount: existing.length + merged.length,
              cappedAt: data.capped_at,
            }
            return {
              ...prev,
              [type]: {
                ...prev[type],
                [itemsKey]: [...existing, ...merged],
                coverage: data.coverage ?? prev[type]?.coverage,
                capped_at: data.capped_at ?? prev[type]?.capped_at,
              },
            }
          })
          markUpdated(type)

          return appendResult
        } catch (err) {
          setErrors((prev) => ({
            ...prev,
            [type]: err instanceof Error ? err.message : 'Generation failed',
          }))
          throw err
        } finally {
          setLoading((prev) => ({ ...prev, [type]: false }))
        }
      }

      const data = await fetchType(type, options)
      const itemsKey = type === 'quiz' ? 'questions' : 'flashcards'
      const generatedCount =
        data?.[itemsKey]?.length ?? (type === 'summary' ? 1 : action.count)

      return {
        generatedCount,
        cappedAt: data?.capped_at,
      }
    },
    [docId, markUpdated],
  )

  const handleStudyWeakTopics = useCallback(
    async (topicFilter) => {
      setStudyWeakLoading(true)
      try {
        const action = {
          type: 'append_flashcards',
          count: 10,
          topic_filter: topicFilter,
        }
        const result = await handleChatAction(action)
        showToast(getActionToastMessage(action, result))
        setActiveTab('flashcards')
      } catch {
        showToast('Failed to generate flashcards for weak topics')
      } finally {
        setStudyWeakLoading(false)
      }
    },
    [handleChatAction, showToast],
  )

  useEffect(() => {
    if (docId) {
      fetchType('summary')
    }
  }, [docId])

  useEffect(() => {
    if (activeTab === 'flashcards' && docId) {
      fetchType('flashcards')
    }
  }, [activeTab, docId])

  useEffect(() => {
    if (activeTab === 'quiz' && docId) {
      fetchType('quiz')
    }
  }, [activeTab, docId])

  return (
    <div className="min-h-screen bg-zinc-950 px-3 py-6 text-zinc-100 sm:px-4 sm:py-8">
      <Toast message={toast} />

      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Study</h1>
          <Link
            to="/"
            className="shrink-0 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            ← Home
          </Link>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-1 rounded-lg bg-zinc-900 p-1 sm:min-w-0">
            {TABS.map((tab) => {
              const updated = formatLastUpdated(lastUpdated[tab.id])
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-[5.5rem] flex-1 flex-col items-center rounded-md px-3 py-2 transition-colors sm:min-w-0 ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className="whitespace-nowrap text-sm font-medium">
                    {tab.label}
                  </span>
                  {updated && tab.id !== 'chat' && (
                    <span className="mt-0.5 whitespace-nowrap text-[10px] font-normal text-zinc-500">
                      {updated}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-xl sm:mt-6 sm:p-6">
          {activeTab === 'summary' && (
            <SummaryTab
              data={cache.summary}
              loading={loading.summary}
              error={errors.summary}
            />
          )}

          {activeTab === 'flashcards' && (
            <FlashcardsTab
              data={cache.flashcards}
              loading={loading.flashcards}
              error={errors.flashcards}
            />
          )}

          {activeTab === 'quiz' && (
            <ErrorBoundary>
              <QuizTab
                data={cache.quiz}
                loading={loading.quiz}
                error={errors.quiz}
                onStudyWeakTopics={handleStudyWeakTopics}
                studyWeakLoading={studyWeakLoading}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'chat' && (
            <ChatTab
              docId={docId}
              messages={chatMessages}
              onMessagesChange={setChatMessages}
              onHandleAction={handleChatAction}
              onShowToast={showToast}
              onGoToTab={setActiveTab}
            />
          )}
        </div>
      </div>
    </div>
  )
}
