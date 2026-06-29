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
    <div className="chat-assistant-row">
      <div className="chat-avatar" aria-hidden="true">
        ✨
      </div>
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        <span
          className="size-2 animate-bounce rounded-full [animation-delay:0ms]"
          style={{ background: 'var(--accent)' }}
        />
        <span
          className="size-2 animate-bounce rounded-full [animation-delay:150ms]"
          style={{ background: 'var(--accent)' }}
        />
        <span
          className="size-2 animate-bounce rounded-full [animation-delay:300ms]"
          style={{ background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}

function AssistantMessage({ content, sources, action, onGoToTab }) {
  const tab = getActionTab(action)

  return (
    <div className="chat-assistant-row">
      <div className="chat-avatar" aria-hidden="true">
        🧠
      </div>
      <div className="chat-assistant-bubble">
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        {action && tab && onGoToTab && (
          <button
            type="button"
            onClick={() => onGoToTab(tab)}
            className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150"
            style={{
              background: 'var(--accent-glow)',
              color: 'var(--accent)',
              border: '1px solid var(--border-accent)',
            }}
          >
            {getActionButtonLabel(action)}
          </button>
        )}
        {sources?.length > 0 && (
          <details className="chat-sources mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            <summary>Sources ({sources.length})</summary>
            <div className="mt-2 space-y-2">
              {sources.map((source, index) => (
                <p
                  key={index}
                  className="rounded-lg p-2 text-xs leading-relaxed"
                  style={{
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                  }}
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
      <div className="chat-user-bubble">
        <p className="whitespace-pre-wrap text-sm">{content}</p>
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
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
          <p
            className="py-8 text-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
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
        <p
          className="mt-3 rounded-lg px-3 py-2 text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--danger)',
          }}
        >
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
          className="chat-input sm:px-4"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="chat-send-btn"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
