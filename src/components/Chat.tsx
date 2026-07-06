'use client'

import { useState } from 'react'
import type { Source } from '@/lib/types'
import { SourceChips } from '@/components/SourceChips'

interface UiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

const STARTERS = [
  'I feel anxious right now',
  'Help me meet my inner critic',
  'Give me a journal prompt',
]

export function Chat() {
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(preset?: string) {
    const text = (preset ?? input).trim()
    if (!text || loading) return
    const next: UiMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply ?? data.error ?? '…', sources: data.sources },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something interrupted us. Take a breath and try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <p className="welcome-h">Hi, I&apos;m here with you.</p>
            <p className="welcome-p">
              Tell me how you&apos;re feeling, or ask about breathwork, meditation, or shadow work. Everything I offer
              comes from the practices on the right — so it stays true to the method.
            </p>
            <div className="starters">
              {STARTERS.map((s) => (
                <button key={s} className="starter" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.content}</div>
            {m.role === 'assistant' && <SourceChips sources={m.sources ?? []} />}
          </div>
        ))}

        {loading && (
          <div className="msg assistant">
            <div className="typing" aria-label="Coach is reflecting">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Share what's on your mind…"
          aria-label="Message"
        />
        <button onClick={() => send()} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  )
}
