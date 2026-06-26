import { useEffect, useMemo, useState } from 'react'
import CoverageInfo from './CoverageInfo'
import LoadingPanel from './LoadingPanel'
import {
  getLetterGrade,
  groupByTopic,
  printHtml,
  shuffleArray,
} from '../utils/quizHelpers'

function optionClass(optionIndex, selected, correctIndex) {
  const base =
    'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors'

  if (selected === null) {
    return `${base} border-zinc-700 bg-zinc-800/50 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800`
  }

  if (optionIndex === correctIndex) {
    return `${base} border-green-600 bg-green-950/60 text-green-300`
  }

  if (optionIndex === selected) {
    return `${base} border-red-600 bg-red-950/60 text-red-300`
  }

  return `${base} border-zinc-800 bg-zinc-900/50 text-zinc-500 opacity-60`
}

export default function QuizTab({
  data,
  loading,
  error,
  onStudyWeakTopics,
  studyWeakLoading,
}) {
  const sourceQuestions = data?.questions ?? []
  const [questionOrder, setQuestionOrder] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [showResults, setShowResults] = useState(false)

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
    }
  }, [sourceQuestions])

  if (loading) return <LoadingPanel type="quiz" />

  if (error) {
    return (
      <div className="rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    )
  }

  if (sourceQuestions.length === 0) return null

  const mappedAnswers = answers
  const score = mappedAnswers.filter(
    (selected, i) => selected === questions[i]?.correct,
  ).length

  const grade = getLetterGrade(score, questions.length)
  const topicBreakdown = groupByTopic(questions, mappedAnswers)
  const weakTopics = topicBreakdown.filter((t) => t.correct < t.total)

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
    const shuffled = shuffleArray(sourceQuestions.map((_, i) => i))
    setQuestionOrder(shuffled)
    setAnswers(Array(sourceQuestions.length).fill(null))
    setCurrentIndex(0)
    setShowResults(false)
  }

  function handleExportResults() {
    const topicsHtml = topicBreakdown
      .map(
        (t) =>
          `<div class="card"><p class="q">${t.topic}</p><p class="meta">${t.correct}/${t.total} correct (${Math.round((t.correct / t.total) * 100)}%)</p></div>`,
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
       <p class="meta">Grade: ${grade.letter} — ${score}/${questions.length} (${Math.round((score / questions.length) * 100)}%)</p>
       <h2>By topic</h2>${topicsHtml}
       <h2>Question breakdown</h2>${breakdownHtml}`,
    )
  }

  async function handleStudyWeak() {
    if (!onStudyWeakTopics || weakTopics.length === 0) return
    const topicNames = weakTopics.map((t) => t.topic).join(', ')
    await onStudyWeakTopics(topicNames)
  }

  if (showResults) {
    return (
      <div className="space-y-6">
        <CoverageInfo
          coverage={data?.coverage}
          cappedAt={data?.capped_at}
          itemLabel="questions"
        />

        <div className="text-center">
          <div
            className={`mx-auto mb-3 flex size-20 items-center justify-center rounded-2xl text-4xl font-bold ${grade.bg} ${grade.color}`}
          >
            {grade.letter}
          </div>
          <p className="text-sm text-zinc-400">Your score</p>
          <p className="mt-1 text-3xl font-semibold text-white sm:text-4xl">
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {Math.round((score / questions.length) * 100)}% correct
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-zinc-400">By topic</h3>
          <div className="space-y-2">
            {topicBreakdown.map((t) => {
              const pct = Math.round((t.correct / t.total) * 100)
              const struggled = pct < 70
              return (
                <div
                  key={t.topic}
                  className={`rounded-lg border px-4 py-3 ${
                    struggled
                      ? 'border-red-800/60 bg-red-950/20'
                      : 'border-green-800/60 bg-green-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize text-zinc-200">
                      {t.topic}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        struggled ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {t.correct}/{t.total}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        struggled ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Breakdown</h3>
          {questions.map((q, i) => {
            const selected = mappedAnswers[i]
            const correct = selected === q.correct

            return (
              <div
                key={i}
                className={`rounded-lg border px-4 py-3 ${
                  correct
                    ? 'border-green-800 bg-green-950/30'
                    : 'border-red-800 bg-red-950/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 shrink-0 text-sm font-semibold ${
                      correct ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200">
                      {i + 1}. {q.question}
                    </p>
                    {!correct && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Correct: {q.options[q.correct]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {weakTopics.length > 0 && onStudyWeakTopics && (
            <button
              type="button"
              onClick={handleStudyWeak}
              disabled={studyWeakLoading}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-60"
            >
              {studyWeakLoading ? 'Generating…' : 'Study these topics'}
            </button>
          )}
          <button
            type="button"
            onClick={handleExportResults}
            className="flex-1 rounded-lg border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Export results
          </button>
          <button
            type="button"
            onClick={handleRetake}
            className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
          >
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
      <CoverageInfo
        coverage={data?.coverage}
        cappedAt={data?.capped_at}
        itemLabel="questions"
      />
      <p className="text-center text-sm text-zinc-400">
        Question {currentIndex + 1} / {questions.length}
      </p>

      <p className="text-base font-medium text-zinc-100 sm:text-lg">
        {current.question}
      </p>

      <div className="space-y-2">
        {current.options.map((option, optionIndex) => (
          <button
            key={`${option}-${optionIndex}`}
            type="button"
            onClick={() => handleSelect(optionIndex)}
            disabled={isAnswered}
            className={optionClass(optionIndex, selected, current.correct)}
          >
            {option}
          </button>
        ))}
      </div>

      {isAnswered && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3">
          <p className="text-sm text-zinc-300">{current.explanation}</p>
        </div>
      )}

      {isAnswered && (
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
        >
          {isLast ? 'See results' : 'Next question'}
        </button>
      )}
    </div>
  )
}
