import { useEffect, useMemo, useState } from 'react'
import CoverageInfo from './CoverageInfo'
import LoadingPanel from './LoadingPanel'
import { printHtml } from '../utils/quizHelpers'

const MASTERY = {
  KNOWN: 'known',
  LEARNING: 'learning',
}

export default function FlashcardsTab({ data, loading, error }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mastery, setMastery] = useState({})
  const [reviewWeakOnly, setReviewWeakOnly] = useState(false)

  const allCards = data?.flashcards ?? []

  const displayCards = useMemo(() => {
    if (!reviewWeakOnly) return allCards
    return allCards.filter((_, i) => mastery[i] !== MASTERY.KNOWN)
  }, [allCards, mastery, reviewWeakOnly])

  const total = displayCards.length
  const current = displayCards[index]

  const masteredCount = useMemo(
    () => allCards.filter((_, i) => mastery[i] === MASTERY.KNOWN).length,
    [allCards, mastery],
  )

  useEffect(() => {
    setIndex(0)
    setFlipped(false)
  }, [allCards.length, reviewWeakOnly])

  useEffect(() => {
    setMastery({})
    setReviewWeakOnly(false)
  }, [data?.flashcards])

  function goTo(newIndex) {
    setIndex(newIndex)
    setFlipped(false)
  }

  function getOriginalIndex(card) {
    return allCards.indexOf(card)
  }

  function markCard(status) {
    if (!current) return
    const originalIndex = getOriginalIndex(current)
    setMastery((prev) => ({ ...prev, [originalIndex]: status }))
    if (index < total - 1) {
      goTo(index + 1)
    }
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
      <div className="rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (allCards.length === 0) return null

  const progressPct = allCards.length
    ? Math.round((masteredCount / allCards.length) * 100)
    : 0

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CoverageInfo coverage={data.coverage} />
        <button
          type="button"
          onClick={handleExport}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Export PDF
        </button>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
          <span>
            {masteredCount} / {allCards.length} mastered
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {masteredCount < allCards.length && (
        <button
          type="button"
          onClick={() => {
            setReviewWeakOnly((v) => !v)
            setIndex(0)
            setFlipped(false)
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            reviewWeakOnly
              ? 'bg-violet-600 text-white'
              : 'border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
          }`}
        >
          {reviewWeakOnly ? 'Showing weak cards' : 'Review weak cards'}
        </button>
      )}

      {displayCards.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          All cards mastered! 🎉
        </p>
      ) : (
        <>
          <p className="text-center text-sm text-zinc-400">
            {index + 1} / {total}
          </p>

          <div className="[perspective:1000px]">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="relative mx-auto block h-52 w-full max-w-lg cursor-pointer border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:h-64"
              aria-label={flipped ? 'Show question' : 'Show answer'}
            >
              <div
                className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
                  flipped ? '[transform:rotateY(180deg)]' : ''
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 p-4 sm:p-6 [backface-visibility:hidden]">
                  <p className="text-center text-base font-medium text-zinc-100 sm:text-lg">
                    {current.question}
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800 p-4 sm:p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <p className="text-center text-base text-zinc-200 sm:text-lg">
                    {current.answer}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-zinc-500">Tap card to flip</p>

          {flipped && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => markCard(MASTERY.LEARNING)}
                className="flex-1 rounded-lg border border-amber-700/60 bg-amber-950/30 px-4 py-2.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-950/50 sm:flex-none"
              >
                Still learning
              </button>
              <button
                type="button"
                onClick={() => markCard(MASTERY.KNOWN)}
                className="flex-1 rounded-lg border border-green-700/60 bg-green-950/30 px-4 py-2.5 text-sm font-medium text-green-300 transition-colors hover:bg-green-950/50 sm:flex-none"
              >
                I knew this
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === total - 1}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
