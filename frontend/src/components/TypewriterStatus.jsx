import { useEffect, useState } from 'react'

export default function TypewriterStatus({ messages, intervalMs = 2800 }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [displayed, setDisplayed] = useState('')
  const [charIndex, setCharIndex] = useState(0)

  const currentMessage = messages[messageIndex % messages.length] ?? ''

  useEffect(() => {
    setDisplayed('')
    setCharIndex(0)
  }, [messageIndex, currentMessage])

  useEffect(() => {
    if (charIndex < currentMessage.length) {
      const timer = setTimeout(() => {
        setDisplayed(currentMessage.slice(0, charIndex + 1))
        setCharIndex((c) => c + 1)
      }, 35)
      return () => clearTimeout(timer)
    }

    const nextTimer = setTimeout(() => {
      setMessageIndex((i) => (i + 1) % messages.length)
    }, intervalMs)
    return () => clearTimeout(nextTimer)
  }, [charIndex, currentMessage, messages.length, intervalMs])

  return (
    <p className="mt-4 text-sm text-zinc-400">
      {displayed}
      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-400" />
    </p>
  )
}
