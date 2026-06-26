import TypewriterStatus from './TypewriterStatus'
import { FlashcardSkeleton, QuizSkeleton, SummarySkeleton } from './Skeleton'

const STATUS_MESSAGES = {
  summary: [
    'Reading your document...',
    'Identifying key concepts...',
    'Almost done...',
  ],
  flashcards: [
    'Creating flashcards...',
    'Finding the most important concepts...',
    'Polishing your deck...',
  ],
  quiz: [
    'Writing quiz questions...',
    'Adding tricky distractors...',
    'Finalizing your quiz...',
  ],
}

const SKELETONS = {
  summary: SummarySkeleton,
  flashcards: FlashcardSkeleton,
  quiz: QuizSkeleton,
}

export default function LoadingPanel({ type }) {
  const Skeleton = SKELETONS[type] ?? SummarySkeleton
  const messages = STATUS_MESSAGES[type] ?? STATUS_MESSAGES.summary

  return (
    <div className="py-8">
      <Skeleton />
      <div className="flex justify-center">
        <TypewriterStatus messages={messages} />
      </div>
    </div>
  )
}
