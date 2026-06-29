import { useEffect, useMemo, useRef, useState } from 'react'
import { submitQuiz } from '../api/quiz'
import CoverageInfo from './CoverageInfo'
import LoadingPanel from './LoadingPanel'
import {
  getLetterGrade,
  hasBrokenOptions,
  printHtml,
  shuffleArray,
} from '../utils/quizHelpers'

const OPTION_LETTERS = ['A', 'B', 'C', 'D']

function getOptionClass(optionIndex, selected, correctIndex) {
  if (selected === null) return 'quiz-option'

  if (optionIndex === correctIndex) return 'quiz-option correct'
  if (optionIndex === selected) return 'quiz-option wrong'
  return 'quiz-option dimmed'
}

function strengthBadge(strength) {
  switch (strength) {
    case 'weak':
      return { label: 'Needs Work', className: 'badge-weak' }
    case 'medium':
      return { label: 'Getting There', className: 'badge-medium' }
    case 'strong':
      return { label: 'Mastered', className: 'badge-strong' }
    default:
      return { label: 'Getting There', className: 'badge-medium' }
  }
}

export default function QuizTab({
  docId,
  data,
  loading,
  error,
  onStudyWeakTopics,
  studyWeakLoading,
  onRegenerate,
  onAdaptiveQuiz,
  adaptiveQuizLoading,
  previousQuizScorePct,
  onAttemptComplete,
}) {
  const sourceQuestions = data?.questions ?? []
  const [questionOrder, setQuestionOrder] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [performanceProfile, setPerformanceProfile] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deltaBaselinePct, setDeltaBaselinePct] = useState(null)
  const submittedRef = useRef(false)

  const questions = useMemo(() => {
    if (sourceQuestions.length === 0) return []

    const order =
      questionOrder.length === sourceQuestions.length
        ? questionOrder
        : sourceQuestions.map((_, i) => i)

    return order.map((i) => sourceQuestions[i]).filter(Boolean)
  }, [questionOrder, sourceQuestions])

  useEffect(() => {
    if (sourceQuestions.length > 0) {
      setQuestionOrder(sourceQuestions.map((_, i) => i))
      setAnswers(Array(sourceQuestions.length).fill(null))
      setCurrentIndex(0)
      setShowResults(false)
      setPerformanceProfile(null)
      setSubmitError(null)
      submittedRef.current = false
    }
  }, [sourceQuestions])

  const mappedAnswers = answers
  const score = mappedAnswers.filter(
    (selected, i) => selected === questions[i]?.correct,
  ).length
  const scorePct =
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  const progressPct =
    questions.length > 0
      ? Math.round(((currentIndex + 1) / questions.length) * 100)
      : 0

  useEffect(() => {
    if (!showResults || !docId || questions.length === 0) return
    if (submittedRef.current) return

    submittedRef.current = true
    setDeltaBaselinePct(previousQuizScorePct)
    setSubmitting(true)
    setSubmitError(null)

    submitQuiz(docId, questions, mappedAnswers)
      .then((profile) => setPerformanceProfile(profile))
      .catch((err) => {
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to analyze performance',
        )
      })
      .finally(() => setSubmitting(false))
  }, [showResults, docId, questions, mappedAnswers, previousQuizScorePct])

  if (loading) return <LoadingPanel type="quiz" />

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

  if (sourceQuestions.length === 0) return null

  if (hasBrokenOptions(sourceQuestions)) {
    return (
      <div
        className="space-y-4 rounded-lg px-4 py-6 text-center"
        style={{ background: 'rgba(239, 68, 68, 0.08)' }}
      >
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Quiz failed to load properly — please regenerate
        </p>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn-primary max-w-xs">
            Regenerate quiz
          </button>
        )}
      </div>
    )
  }

  const grade = getLetterGrade(score, questions.length)
  const weakTopics =
    performanceProfile?.weak_topics ??
    Object.entries(performanceProfile?.topics ?? {})
      .filter(([, stats]) => stats.strength === 'weak')
      .map(([name]) => name)

  const scoreDelta =
    deltaBaselinePct != null ? scorePct - deltaBaselinePct : null

  function saveAttemptScore() {
    if (onAttemptComplete) onAttemptComplete(scorePct)
  }

  function handleSelect(optionIndex) {
    if (mappedAnswers[currentIndex] !== null) return

    setAnswers((prev) => {
      const next = [...prev]
      next[currentIndex] = optionIndex
      return next
    })
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setShowResults(true)
    }
  }

  function handleRetake() {
    saveAttemptScore()
    const shuffled = shuffleArray(sourceQuestions.map((_, i) => i))
    setQuestionOrder(shuffled)
    setAnswers(Array(sourceQuestions.length).fill(null))
    setCurrentIndex(0)
    setShowResults(false)
    submittedRef.current = false
  }

  async function handleAdaptiveQuiz() {
    if (!onAdaptiveQuiz) return
    saveAttemptScore()
    await onAdaptiveQuiz()
  }

  function handleExportResults() {
    const topicEntries = performanceProfile?.topics
      ? Object.entries(performanceProfile.topics)
      : []

    const topicsHtml = topicEntries
      .map(
        ([topic, stats]) =>
          `<div class="card"><p class="q">${topic}</p><p class="meta">${stats.correct}/${stats.total} correct (${Math.round(stats.score * 100)}%)</p></div>`,
      )
      .join('')

    const breakdownHtml = questions
      .map((q, i) => {
        const correct = mappedAnswers[i] === q.correct
        return `<div class="card"><p class="q">${correct ? '✓' : '✗'} ${q.question}</p>${
          !correct ? `<p>Correct: ${q.options[q.correct]}</p>` : ''
        }</div>`
      })
      .join('')

    printHtml(
      'StudyAI Quiz Results',
      `<h1>Quiz Results</h1>
       <p class="meta">Grade: ${grade.letter} — ${score}/${questions.length} (${scorePct}%)</p>
       <h2>By topic</h2>${topicsHtml}
       <h2>Question breakdown</h2>${breakdownHtml}`,
    )
  }

  async function handleStudyWeak() {
    if (!onStudyWeakTopics || weakTopics.length === 0) return
    const topicNames = weakTopics.join(', ')
    await onStudyWeakTopics(topicNames)
  }

  if (showResults) {
    const topicEntries = performanceProfile?.topics
      ? Object.entries(performanceProfile.topics).sort(
          ([, a], [, b]) => a.score - b.score,
        )
      : []

    return (
      <div className="space-y-6">
        <CoverageInfo coverage={data?.coverage} />

        <div className="text-center">
          <div
            className={`mx-auto mb-3 flex size-20 items-center justify-center rounded-2xl text-4xl font-bold ${grade.bg} ${grade.color}`}
          >
            {grade.letter}
          </div>
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Your score
            </p>
            {data?.adaptive && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background: 'var(--accent-glow)',
                  color: 'var(--accent-secondary)',
                  border: '1px solid var(--border-accent)',
                }}
              >
                Adaptive
              </span>
            )}
          </div>
          <p
            className="mt-1 text-3xl font-bold sm:text-4xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {scorePct}% correct
          </p>
          {scoreDelta != null && scoreDelta !== 0 && (
            <p
              className="mt-1 text-sm font-medium"
              style={{ color: scoreDelta > 0 ? 'var(--success)' : 'var(--danger)' }}
            >
              {scoreDelta > 0 ? '+' : ''}
              {scoreDelta}% from last attempt
            </p>
          )}
          {scoreDelta === 0 && deltaBaselinePct != null && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Same as last attempt
            </p>
          )}
        </div>

        <div>
          <h3
            className="mb-3 text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Performance Breakdown
            {submitting && (
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Analyzing…
              </span>
            )}
          </h3>
          {submitError && (
            <p className="mb-2 text-xs" style={{ color: 'var(--danger)' }}>
              {submitError}
            </p>
          )}
          {topicEntries.length > 0 ? (
            <div className="space-y-2">
              {topicEntries.map(([topic, stats]) => {
                const badge = strengthBadge(stats.strength)
                return (
                  <div key={topic} className="surface-elevated px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="text-sm font-medium capitalize"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {topic}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {stats.correct} / {stats.total} correct
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            !submitting && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Topic breakdown will appear after analysis completes.
              </p>
            )
          )}
        </div>

        <div className="space-y-3">
          <h3
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Breakdown
          </h3>
          {questions.map((q, i) => {
            const selected = mappedAnswers[i]
            const correct = selected === q.correct

            return (
              <div
                key={i}
                className="rounded-lg border px-4 py-3"
                style={{
                  borderColor: correct
                    ? 'rgba(16, 185, 129, 0.4)'
                    : 'rgba(239, 68, 68, 0.4)',
                  background: correct
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 shrink-0 text-sm font-semibold"
                    style={{ color: correct ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {i + 1}. {q.question}
                    </p>
                    {!correct && (
                      <p
                        className="mt-1 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Correct: {q.options[q.correct]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {weakTopics.length > 0 && onStudyWeakTopics && (
            <button
              type="button"
              onClick={handleStudyWeak}
              disabled={studyWeakLoading}
              className="btn-primary flex-1 disabled:opacity-60"
            >
              {studyWeakLoading ? 'Generating…' : 'Study these topics'}
            </button>
          )}
          {onAdaptiveQuiz && (
            <button
              type="button"
              onClick={handleAdaptiveQuiz}
              disabled={adaptiveQuizLoading}
              className="btn-ghost flex-1 disabled:opacity-60"
            >
              {adaptiveQuizLoading ? 'Generating…' : '🧠 Adaptive Quiz'}
            </button>
          )}
          <button type="button" onClick={handleExportResults} className="btn-ghost flex-1">
            Export results
          </button>
          <button type="button" onClick={handleRetake} className="btn-primary flex-1">
            Retake (shuffled)
          </button>
        </div>
      </div>
    )
  }

  const current = questions[currentIndex]
  const selected = mappedAnswers[currentIndex]
  const isAnswered = selected !== null
  const isLast = currentIndex === questions.length - 1

  if (!current) {
    return <LoadingPanel type="quiz" />
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {data?.adaptive && (
        <div className="adaptive-banner">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--accent)' }}
          >
            Adaptive mode — focusing on your weak areas
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {data.adaptive_summary ||
              'Focusing on your weak areas from your last attempt'}
          </p>
        </div>
      )}

      <div className="quiz-progress-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <CoverageInfo coverage={data?.coverage} />

      <div className="text-center">
        <span className="quiz-counter-pill">
          Question {currentIndex + 1} / {questions.length}
        </span>
      </div>

      <p
        className="text-lg font-bold sm:text-xl"
        style={{ color: 'var(--text-primary)' }}
      >
        {current.question}
      </p>

      <div className="space-y-2.5">
        {current.options.map((option, optionIndex) => (
          <button
            key={`${option}-${optionIndex}`}
            type="button"
            onClick={() => handleSelect(optionIndex)}
            disabled={isAnswered}
            className={getOptionClass(optionIndex, selected, current.correct)}
          >
            <span className="quiz-option-letter">
              {OPTION_LETTERS[optionIndex] ?? '?'}
            </span>
            <span>{option}</span>
          </button>
        ))}
      </div>

      {isAnswered && (
        <div className="quiz-explanation">
          💡 {current.explanation}
        </div>
      )}

      {isAnswered && (
        <button type="button" onClick={handleNext} className="btn-primary">
          {isLast ? 'See results' : 'Next question'}
        </button>
      )}
    </div>
  )
}
