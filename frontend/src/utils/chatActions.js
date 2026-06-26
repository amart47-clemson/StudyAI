const ACTION_TAB = {
  regenerate_quiz: 'quiz',
  append_quiz: 'quiz',
  regenerate_flashcards: 'flashcards',
  append_flashcards: 'flashcards',
  regenerate_summary: 'summary',
  navigate: null,
}

const ACTION_BUTTON_LABEL = {
  regenerate_quiz: 'Go to Quiz →',
  append_quiz: 'Go to Quiz →',
  regenerate_flashcards: 'Go to Flashcards →',
  append_flashcards: 'Go to Flashcards →',
  regenerate_summary: 'Go to Summary →',
  navigate: null,
}

const ACTION_GENERATE_TYPE = {
  regenerate_quiz: 'quiz',
  append_quiz: 'quiz',
  regenerate_flashcards: 'flashcards',
  append_flashcards: 'flashcards',
  regenerate_summary: 'summary',
}

const NAVIGATE_LABELS = {
  summary: 'Summary',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  chat: 'Chat',
}

export function getActionTab(action) {
  if (!action) return null
  if (action.type === 'navigate') return action.target
  return ACTION_TAB[action.type]
}

export function getActionButtonLabel(action) {
  if (!action) return null
  if (action.type === 'navigate') {
    const label = NAVIGATE_LABELS[action.target] ?? action.target
    return `Go to ${label} →`
  }
  return ACTION_BUTTON_LABEL[action.type]
}

export function getActionGenerateType(actionType) {
  return ACTION_GENERATE_TYPE[actionType]
}

export function isAppendAction(actionType) {
  return actionType === 'append_quiz' || actionType === 'append_flashcards'
}

export function isNavigateAction(action) {
  return action?.type === 'navigate'
}

export function dedupeByQuestion(existing, incoming) {
  const seen = new Set(
    (existing ?? []).map((item) => item.question?.toLowerCase().trim()),
  )
  return (incoming ?? []).filter((item) => {
    const key = item.question?.toLowerCase().trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cappedSuffix(result) {
  if (result?.cappedAt != null) {
    return ` — capped at ${result.cappedAt}, not enough document content for more`
  }
  return ''
}

function formatLabelForToast(action) {
  if (action.format === 'true_false') return 'true/false '
  if (action.format === 'short_answer') return 'short-answer '
  return ''
}

export function getActionToastMessage(action, result = {}) {
  if (!action) return 'Content updated'

  if (action.type === 'navigate') {
    const label = NAVIGATE_LABELS[action.target] ?? action.target
    return `Switched to ${label}`
  }

  const capped = cappedSuffix(result)
  const formatPrefix = formatLabelForToast(action)

  switch (action.type) {
    case 'regenerate_quiz': {
      const count = result.generatedCount ?? action.count
      return `Quiz updated — ${count} ${formatPrefix}questions generated${capped}`
    }
    case 'append_quiz': {
      const added = result.addedCount ?? action.count
      const total = result.totalCount
      const totalPart = total != null ? ` (now ${total} total)` : ''
      return `Added ${added} ${formatPrefix}questions to your quiz${totalPart}${capped}`
    }
    case 'regenerate_flashcards': {
      const count = result.generatedCount ?? action.count
      return `Flashcards updated — ${count} cards generated${capped}`
    }
    case 'append_flashcards': {
      const added = result.addedCount ?? action.count
      const total = result.totalCount
      const totalPart = total != null ? ` (now ${total} total)` : ''
      return `Added ${added} flashcards${totalPart}${capped}`
    }
    case 'regenerate_summary':
      return 'Summary updated'
    default:
      if (action.format === 'true_false') return `Switched to true/false format${capped}`
      if (action.format === 'short_answer') return `Switched to short-answer format${capped}`
      if (action.format === 'multiple_choice') return `Switched to multiple choice format${capped}`
      if (action.difficulty) return `Updated to ${action.difficulty} difficulty${capped}`
      return `Content updated${capped}`
  }
}
