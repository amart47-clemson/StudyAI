import { useEffect, useMemo, useState } from 'react'
import CoverageInfo from './CoverageInfo'
import LoadingPanel from './LoadingPanel'
import { printHtml } from '../utils/quizHelpers'

const MASTERY = {
  KNOWN: 'known',
  LEARNING: 'learning',
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function FlashcardsTab({ data, loading, error, onGoToQuiz }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mastery, setMastery] = useState({})
  const [reviewWeakOnly, setReviewWeakOnly] = useState(false)
  const [deckComplete, setDeckComplete] = useState(false)

  const allCards = data?.flashcards ?? []

  const displayIndices = useMemo(() => {
    if (!reviewWeakOnly) {
      return allCards.map((_, i) => i)
    }
    return allCards
      .map((_, i) => i)
      .filter((i) => mastery[i] !== MASTERY.KNOWN)
  }, [allCards, mastery, reviewWeakOnly])

  const displayCards = useMemo(
    () => displayIndices.map((i) => allCards[i]),
    [allCards, displayIndices],
  )

  const total = displayCards.length
  const current = displayCards[index] ?? null
  const currentOriginalIndex = displayIndices[index] ?? null

  const masteredCount = useMemo(
    () => allCards.filter((_, i) => mastery[i] === MASTERY.KNOWN).length,
    [allCards, mastery],
  )

  useEffect(() => {
    setIndex(0)
    setFlipped(false)
    setDeckComplete(false)
  }, [allCards.length, reviewWeakOnly])

  useEffect(() => {
    setMastery({})
    setReviewWeakOnly(false)
    setDeckComplete(false)
  }, [data?.flashcards])

  useEffect(() => {
    if (displayIndices.length === 0) return
    if (index >= displayIndices.length) {
      setIndex(Math.max(0, displayIndices.length - 1))
    }
  }, [displayIndices.length, index])

  function goTo(newIndex) {
    setDeckComplete(false)
    setIndex(Math.max(0, Math.min(newIndex, total - 1)))
    setFlipped(false)
  }

  function markCard(status, event) {
    event?.stopPropagation()
    event?.preventDefault()

    if (currentOriginalIndex == null || current == null) return

    const onLastCard = index >= total - 1

    setMastery((prev) => ({ ...prev, [currentOriginalIndex]: status }))
    setFlipped(false)

    if (onLastCard) {
      setDeckComplete(true)
      return
    }

    if (reviewWeakOnly && status === MASTERY.KNOWN) {
      // Card drops from the filtered list; keep index so the next card slides in.
      return
    }

    setIndex((i) => Math.min(i + 1, total - 1))
  }

  function handleReviewWeak() {
    setReviewWeakOnly(true)
    setIndex(0)
    setFlipped(false)
    setDeckComplete(false)
  }

  function handleExport() {
    const cardsHtml = allCards
      .map(
        (card, i) => `
        <div class="card">
          <p class="q">${i + 1}. ${card.question}</p>
          <p>${card.answer}</p>
        </div>`,
      )
      .join('')

    printHtml(
      'StudyAI Flashcards',
      `<h1>Flashcards</h1><p class="meta">${allCards.length} cards</p>${cardsHtml}`,
    )
  }

  if (loading) return <LoadingPanel type="flashcards" />

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

  if (allCards.length === 0) return null

  const progressPct = allCards.length
    ? Math.round((masteredCount / allCards.length) * 100)
    : 0

  const cardProgressPct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CoverageInfo coverage={data.coverage} />
        <button
          type="button"
          onClick={handleExport}
          className="btn-ghost shrink-0 !w-auto px-3 py-1.5 text-xs"
        >
          Export PDF
        </button>
      </div>

      <div>
        <div
          className="mb-1.5 flex items-center justify-between text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span>
            {masteredCount} / {allCards.length} mastered
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="mastery-bar">
          <div
            className="mastery-bar-fill"
            style={{
              width: `${progressPct}%`,
              background:
                'linear-gradient(90deg, var(--danger), var(--warning), var(--success))',
            }}
          />
        </div>
      </div>

      {masteredCount < allCards.length && !deckComplete && (
        <button
          type="button"
          onClick={() => {
            setReviewWeakOnly((v) => !v)
            setIndex(0)
            setFlipped(false)
            setDeckComplete(false)
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
          style={
            reviewWeakOnly
              ? {
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 0 16px rgba(108, 99, 255, 0.35)',
                }
              : {
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }
          }
        >
          {reviewWeakOnly ? 'Showing weak cards' : 'Review weak cards'}
        </button>
      )}

      {deckComplete && (
        <div
          className="rounded-xl px-4 py-4 text-center"
          style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--border-accent)',
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            You&apos;ve reviewed all cards!
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {masteredCount} / {allCards.length} mastered
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {masteredCount < allCards.length && (
              <button
                type="button"
                onClick={handleReviewWeak}
                className="btn-ghost !w-auto px-4 py-2 text-sm"
              >
                Review weak cards
              </button>
            )}
            {onGoToQuiz && (
              <button
                type="button"
                onClick={onGoToQuiz}
                className="btn-primary !w-auto px-4 py-2 text-sm"
              >
                Go to quiz
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDeckComplete(false)
                setIndex(0)
                setFlipped(false)
              }}
              className="btn-ghost !w-auto px-4 py-2 text-sm"
            >
              Review again
            </button>
          </div>
        </div>
      )}

      {displayCards.length === 0 ? (
        <p
          className="py-12 text-center text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          All cards mastered! 🎉
        </p>
      ) : (
        <>
          <div className="quiz-progress-bar">
            <div
              className="quiz-progress-fill"
              style={{ width: `${cardProgressPct}%` }}
            />
          </div>

          <p
            className="text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="quiz-counter-pill">
              {index + 1} / {total}
            </span>
          </p>

          <div className="[perspective:1000px]">
            <button
              type="button"
              onClick={() => {
                setDeckComplete(false)
                setFlipped((f) => !f)
              }}
              className="relative mx-auto block min-h-[260px] w-full max-w-lg cursor-pointer border-0 bg-transparent p-0 focus:outline-none sm:min-h-[280px]"
              aria-label={flipped ? 'Show question' : 'Show answer'}
            >
              <div
                className={`relative h-full min-h-[260px] w-full transition-transform duration-500 [transform-style:preserve-3d] sm:min-h-[280px] ${
                  flipped ? '[transform:rotateY(180deg)]' : ''
                }`}
              >
                <div className="flashcard-face absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8 [backface-visibility:hidden]">
                  <span className="flashcard-label-q mb-3">Question</span>
                  <p
                    className="text-center text-base font-medium sm:text-lg"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {current?.question}
                  </p>
                </div>
                <div className="flashcard-face absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="flashcard-label-a mb-3">Answer</span>
                  <p
                    className="text-center text-base sm:text-lg"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {current?.answer}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <p
            className="text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Tap card to flip
          </p>

          {flipped && current && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={(e) => markCard(MASTERY.LEARNING, e)}
                className="btn-learning flex-1 sm:flex-none"
              >
                ↻ Still learning
              </button>
              <button
                type="button"
                onClick={(e) => markCard(MASTERY.KNOWN, e)}
                className="btn-known flex-1 sm:flex-none"
              >
                ✓ I knew this
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="nav-circle-btn"
              aria-label="Previous card"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1}
              className="nav-circle-btn"
              aria-label="Next card"
            >
              <ChevronRight />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
