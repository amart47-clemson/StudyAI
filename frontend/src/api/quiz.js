import { API_BASE } from './config'

export async function submitQuiz(docId, questions, userAnswers) {
  const response = await fetch(`${API_BASE}/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_id: docId,
      questions,
      user_answers: userAnswers,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit quiz')
  }

  return data
}
