import { useState, useRef, useEffect } from 'react'
import { authHeaders } from '../auth'
import { USE_MOCKS } from '../mocks/useMockMode'
import { mockQueryResponse } from '../mocks/mockData'

export default function ChatPanel({ repoId, onCitations, onCitationClick }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    // MOCK MODE: Return mock response after brief delay
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 500)) // Simulate thinking
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: mockQueryResponse.answer, citations: mockQueryResponse.citations },
      ])
      onCitations?.(mockQueryResponse.citations || [])
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ repo_id: repoId, question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Query failed')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, citations: data.citations },
      ])
      onCitations?.(data.citations || [])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const renderContent = (text, citations) => {
    // Replace [file:start-end] with clickable links
    const parts = text.split(/(\[[^\]]+:\d+-\d+\])/)
    return parts.map((part, i) => {
      const m = part.match(/^\[([^:]+):(\d+)-(\d+)\]$/)
      if (m) {
        const cit = { file: m[1], start_line: parseInt(m[2]), end_line: parseInt(m[3]) }
        return (
          <button
            key={i}
            onClick={() => onCitationClick?.(cit)}
            className="text-cyan-400 hover:text-cyan-300 underline text-xs mx-0.5"
          >
            {part}
          </button>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-slate-400 border-b border-slate-700 uppercase tracking-wider">
        Ask Atlas
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-slate-300' : 'text-slate-100'}`}>
            <span className={`font-semibold ${msg.role === 'user' ? 'text-cyan-400' : 'text-emerald-400'}`}>
              {msg.role === 'user' ? 'You' : 'Atlas'}:
            </span>{' '}
            <span className="whitespace-pre-wrap">{renderContent(msg.content, msg.citations)}</span>
          </div>
        ))}
        {loading && <div className="text-xs text-slate-500 animate-pulse">Atlas is thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-slate-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hey Atlas, how does X work?"
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
