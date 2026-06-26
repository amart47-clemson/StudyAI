import { useEffect, useRef, useState } from 'react'
import { sendChat } from '../api/chat'
import {
  getActionButtonLabel,
  getActionTab,
  getActionToastMessage,
  isNavigateAction,
} from '../utils/chatActions'

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-zinc-700 bg-zinc-800 px-4 py-3">
        <span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
        <span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function AssistantMessage({ content, sources, action, onGoToTab }) {
  const tab = getActionTab(action)

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-zinc-700 bg-zinc-800 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-zinc-100">{content}</p>
        {action && tab && onGoToTab && (
          <button
            type="button"
            onClick={() => onGoToTab(tab)}
            className="mt-3 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            {getActionButtonLabel(action)}
          </button>
        )}
        {sources?.length > 0 && (
          <details className="mt-3 border-t border-zinc-700 pt-2">
            <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-300">
              Sources ({sources.length})
            </summary>
            <div className="mt-2 space-y-2">
              {sources.map((source, index) => (
                <p
                  key={index}
                  className="rounded-lg bg-zinc-900/80 p-2 text-xs leading-relaxed text-zinc-400"
                >
                  {source}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

function UserMessage({ content }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-zinc-900">{content}</p>
      </div>
    </div>
  )
}

export default function ChatTab({
  docId,
  messages,
  onMessagesChange,
  onHandleAction,
  onShowToast,
  onGoToTab,
}) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(event) {
    event?.preventDefault()

    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)

    const history = messages.map(({ role, content }) => ({ role, content }))
    onMessagesChange((prev) => [...prev, { role: 'user', content: text }])

    setLoading(true)

    try {
      const data = await sendChat(docId, text, history)

      let actionResult = {}
      if (data.action) {
        if (isNavigateAction(data.action)) {
          onGoToTab(data.action.target)
        } else {
          actionResult = (await onHandleAction(data.action)) ?? {}
        }
        onShowToast(getActionToastMessage(data.action, actionResult))
      }

      onMessagesChange((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          sources: data.sources ?? [],
          action: data.action ?? null,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend(event)
    }
  }

  return (
    <div className="flex h-[min(70vh,calc(100vh-12rem))] min-h-[360px] flex-col sm:min-h-[480px]">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-zinc-500">
            Ask about your material, or say &ldquo;make 20 quiz questions&rdquo; to
            update your study tools.
          </p>
        )}

        {messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={index} content={message.content} />
          ) : (
            <AssistantMessage
              key={index}
              content={message.content}
              sources={message.sources}
              action={message.action}
              onGoToTab={onGoToTab}
            />
          ),
        )}

        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request new study content…"
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-60 sm:px-4"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
        >
          Send
        </button>
      </form>
    </div>
  )
}
