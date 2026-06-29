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
import { getRecentDocuments } from '../utils/documentHistory'

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
  const [adaptiveQuizLoading, setAdaptiveQuizLoading] = useState(false)
  const [previousQuizScorePct, setPreviousQuizScorePct] = useState(null)
  const [docFilename, setDocFilename] = useState(null)

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

  useEffect(() => {
    const recent = getRecentDocuments().find((d) => d.docId === docId)
    setDocFilename(recent?.filename ?? null)
  }, [docId])

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
    const { count, format, difficulty, topic_filter, mix, adaptive } = options
    const isForced =
      count != null ||
      format != null ||
      difficulty != null ||
      topic_filter != null ||
      mix != null ||
      adaptive != null

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
        mix,
        adaptive,
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

  const regenerateQuiz = useCallback(async () => {
    fetched.current.quiz = false
    await fetchType('quiz', {})
  }, [docId, markUpdated])

  const generateAdaptiveQuiz = useCallback(async () => {
    setAdaptiveQuizLoading(true)
    try {
      const count = cache.quiz?.questions?.length ?? undefined
      await fetchType('quiz', { adaptive: true, count })
    } finally {
      setAdaptiveQuizLoading(false)
    }
  }, [cache.quiz?.questions?.length, docId])

  const handleQuizAttemptComplete = useCallback((scorePct) => {
    setPreviousQuizScorePct(scorePct)
  }, [])

  const handleChatAction = useCallback(
    async (action) => {
      const type = getActionGenerateType(action.type)
      const options = {
        count: action.count,
        format: action.format,
        difficulty: action.difficulty,
        topic_filter: action.topic_filter,
        mix: action.mix,
        adaptive: action.adaptive,
      }

      if (isAppendAction(action.type)) {
        setLoading((prev) => ({ ...prev, [type]: true }))
        setErrors((prev) => ({ ...prev, [type]: null }))

        try {
          const data = await generateContent(docId, type, options)
          const itemsKey = type === 'quiz' ? 'questions' : 'flashcards'
          const incoming = data[itemsKey] ?? []

          let appendResult = { addedCount: 0, totalCount: 0 }

          setCache((prev) => {
            const existing = prev[type]?.[itemsKey] ?? []
            const merged = dedupeByQuestion(existing, incoming)
            appendResult = {
              addedCount: merged.length,
              totalCount: existing.length + merged.length,
            }
            return {
              ...prev,
              [type]: {
                ...prev[type],
                [itemsKey]: [...existing, ...merged],
                coverage: data.coverage ?? prev[type]?.coverage,
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

  function tabIsReady(tabId) {
    if (tabId === 'chat') return chatMessages.length > 0
    if (tabId === 'summary') return cache.summary != null
    if (tabId === 'flashcards') return cache.flashcards != null
    if (tabId === 'quiz') return cache.quiz != null
    return false
  }

  return (
    <div className="study-bg page-enter px-3 py-6 sm:px-4 sm:py-8">
      <Toast message={toast} />

      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-4 sm:mb-6">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1
              className="text-xl font-bold sm:text-2xl"
              style={{ color: 'var(--text-primary)' }}
            >
              Study
            </h1>
            {docFilename && (
              <span
                className="truncate text-sm font-normal"
                style={{ color: 'var(--text-muted)' }}
              >
                · {docFilename}
              </span>
            )}
          </div>
          <Link to="/" className="back-link shrink-0">
            ← Home
          </Link>
        </div>

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="study-tab-bar min-w-max sm:min-w-0">
            {TABS.map((tab) => {
              const updated = formatLastUpdated(lastUpdated[tab.id])
              const isActive = activeTab === tab.id
              const ready = tabIsReady(tab.id)

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`study-tab ${isActive ? 'active' : ''}`}
                >
                  {tab.id !== 'chat' && (
                    <span
                      className={`study-tab-dot ${ready ? 'ready' : 'pending'}`}
                      aria-hidden="true"
                    />
                  )}
                  <span className="whitespace-nowrap text-sm font-medium">
                    {tab.label}
                  </span>
                  {updated && tab.id !== 'chat' && (
                    <span
                      className="mt-0.5 whitespace-nowrap text-[10px] font-normal"
                      style={{
                        color: isActive
                          ? 'rgba(255,255,255,0.7)'
                          : 'var(--text-muted)',
                      }}
                    >
                      {updated}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="content-card mt-4 p-4 shadow-xl sm:mt-6 sm:p-6">
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
              onGoToQuiz={() => setActiveTab('quiz')}
            />
          )}

          {activeTab === 'quiz' && (
            <ErrorBoundary>
              <QuizTab
                docId={docId}
                data={cache.quiz}
                loading={loading.quiz}
                error={errors.quiz}
                onStudyWeakTopics={handleStudyWeakTopics}
                studyWeakLoading={studyWeakLoading}
                onRegenerate={regenerateQuiz}
                onAdaptiveQuiz={generateAdaptiveQuiz}
                adaptiveQuizLoading={adaptiveQuizLoading}
                previousQuizScorePct={previousQuizScorePct}
                onAttemptComplete={handleQuizAttemptComplete}
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
