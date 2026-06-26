const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'did', 'she', 'use', 'than', 'them', 'this', 'that', 'with', 'from',
  'have', 'what', 'when', 'your', 'which', 'their', 'about', 'would',
  'there', 'could', 'other', 'into', 'more', 'also', 'been', 'being',
  'does', 'each', 'will', 'after', 'most', 'such', 'only', 'over',
])

export function extractTopic(question) {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))

  return words[0] ?? 'general'
}

export function groupByTopic(questions, answers) {
  const topics = {}

  questions.forEach((q, i) => {
    const topic = extractTopic(q.question)
    if (!topics[topic]) {
      topics[topic] = { topic, total: 0, correct: 0, wrongIndices: [] }
    }
    topics[topic].total += 1
    if (answers[i] === q.correct) {
      topics[topic].correct += 1
    } else {
      topics[topic].wrongIndices.push(i)
    }
  })

  return Object.values(topics).sort((a, b) => {
    const aRate = a.correct / a.total
    const bRate = b.correct / b.total
    return aRate - bRate
  })
}

export function getLetterGrade(score, total) {
  if (total === 0) return { letter: 'F', color: 'text-red-400', bg: 'bg-red-950/40' }
  const pct = (score / total) * 100
  if (pct >= 90) return { letter: 'A', color: 'text-green-400', bg: 'bg-green-950/40' }
  if (pct >= 80) return { letter: 'B', color: 'text-emerald-400', bg: 'bg-emerald-950/40' }
  if (pct >= 70) return { letter: 'C', color: 'text-yellow-400', bg: 'bg-yellow-950/40' }
  if (pct >= 60) return { letter: 'D', color: 'text-orange-400', bg: 'bg-orange-950/40' }
  return { letter: 'F', color: 'text-red-400', bg: 'bg-red-950/40' }
}

export function shuffleArray(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function printHtml(title, bodyHtml) {
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; color: #111; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
          .q { font-weight: 600; margin-bottom: 0.5rem; }
          .meta { color: #666; font-size: 0.875rem; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)
}
