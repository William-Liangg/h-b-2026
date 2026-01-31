import { useState, useRef, useEffect } from 'react'
import { authHeaders } from '../auth'
import { USE_MOCKS } from '../mocks/useMockMode'
import { mockQueryResponse } from '../mocks/mockData'

export default function ChatPanel({ repoId, onCitations, onCitationClick }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' or 'chunks-{messageIndex}'
  const [openChunksTabs, setOpenChunksTabs] = useState({}) // Map of messageIndex -> chunks data
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
        { 
          role: 'assistant', 
          content: mockQueryResponse.answer, 
          citations: mockQueryResponse.citations,
          chunks: mockQueryResponse.chunks, // Store chunks for display
        },
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
        { 
          role: 'assistant', 
          content: data.answer, 
          citations: data.citations,
          chunks: data.chunks, // Store chunks for display
          outputHash: data.output_hash, // Store hash for determinism display
          citationValidation: data.citation_validation, // Citation accuracy metrics
          retrievalMetrics: data.retrieval_metrics, // Retrieval quality metrics
        },
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
      {/* Tab Bar */}
      <div className="flex items-center border-b border-slate-700 overflow-x-auto">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 ${
            activeTab === 'chat'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Ask Atlas
        </button>
        {Object.entries(openChunksTabs).map(([messageIndex, chunks]) => {
          const tabId = `chunks-${messageIndex}`
          const isActive = activeTab === tabId
          return (
            <div key={tabId} className="flex items-center shrink-0">
              <button
                onClick={() => setActiveTab(tabId)}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Chunks {parseInt(messageIndex) + 1} ({chunks.length})
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const newTabs = { ...openChunksTabs }
                  delete newTabs[messageIndex]
                  setOpenChunksTabs(newTabs)
                  if (activeTab === tabId) {
                    // If closing the active tab, switch to chat or another chunks tab
                    const remainingTabs = Object.keys(newTabs)
                    if (remainingTabs.length > 0) {
                      setActiveTab(`chunks-${remainingTabs[0]}`)
                    } else {
                      setActiveTab('chat')
                    }
                  }
                }}
                className="px-1 py-1 text-xs text-slate-500 hover:text-slate-300"
                title="Close chunks tab"
              >
                ×
              </button>
            </div>
          )
        })}
        {activeTab === 'chat' && messages.length > 0 && messages[messages.length - 1]?.outputHash && (
          <span className="ml-auto text-[10px] normal-case font-mono text-slate-500 px-3 shrink-0">
            Hash: {messages[messages.length - 1].outputHash.slice(0, 8)}...
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {activeTab.startsWith('chunks-') ? (
          (() => {
            const messageIndex = parseInt(activeTab.split('-')[1])
            const chunksData = openChunksTabs[messageIndex]
            if (!chunksData) return null
            return (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Retrieved Chunks from Response {messageIndex + 1} ({chunksData.length})
                </div>
                {chunksData.map((chunk, j) => (
                  <div key={j} className="p-3 bg-slate-800/50 rounded border border-slate-700">
                    <div className="text-cyan-400 font-mono text-xs mb-2">
                      {chunk.file}:{chunk.start_line}-{chunk.end_line}
                    </div>
                    <div className="text-slate-300 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                      {chunk.text}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()
        ) : (
          <>
            {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          
          return (
            <div key={i} className={`text-sm ${isUser ? 'text-slate-300' : 'text-slate-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span className={`font-semibold ${isUser ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {isUser ? 'You' : 'Atlas'}:
                  </span>{' '}
                  <span className="whitespace-pre-wrap">{renderContent(msg.content, msg.citations)}</span>
                  {!isUser && (msg.chunks?.length > 0 || msg.citations?.length > 0) && (
                    <div className="mt-2 space-y-2">
                      <button
                        onClick={() => {
                          // Add or update chunks tab for this message
                          if (msg.chunks && msg.chunks.length > 0) {
                            setOpenChunksTabs(prev => ({
                              ...prev,
                              [i]: msg.chunks
                            }))
                            // Switch to this chunks tab
                            setActiveTab(`chunks-${i}`)
                          }
                        }}
                        disabled={!msg.chunks || msg.chunks.length === 0}
                        className="text-xs px-2 py-1 bg-slate-700/50 hover:bg-slate-700 disabled:bg-slate-800/30 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-300 rounded border border-slate-600 transition-colors"
                      >
                        {openChunksTabs[i] ? 'View' : 'Show'} Retrieved Chunks ({msg.chunks?.length || 0})
                      </button>
                      {/* Simple metrics calculated on frontend */}
                      {(() => {
                        try {
                          const chunks = msg.chunks || []
                          const citations = msg.citations || []
                          
                          // Calculate citation accuracy: how many citations match retrieved chunks
                          const chunkKeys = new Set(
                            chunks.map(c => {
                              const file = c?.file || c?.file_path || ''
                              const start = c?.start_line || c?.start || 0
                              const end = c?.end_line || c?.end || 0
                              return `${file}:${start}-${end}`
                            })
                          )
                          
                          const validCitations = citations.filter(cit => {
                            const file = cit?.file || cit?.file_path || ''
                            const start = cit?.start_line || cit?.start || 0
                            const end = cit?.end_line || cit?.end || 0
                            const key = `${file}:${start}-${end}`
                            return chunkKeys.has(key)
                          })
                          
                          const citationAccuracy = citations.length > 0 
                            ? Math.round((validCitations.length / citations.length) * 100)
                            : 100
                          
                          // Calculate citation rate: how many chunks were cited
                          const citedChunks = chunks.filter(chunk => {
                            const chunkFile = chunk?.file || chunk?.file_path || ''
                            const chunkStart = chunk?.start_line || chunk?.start || 0
                            const chunkEnd = chunk?.end_line || chunk?.end || 0
                            return citations.some(cit => {
                              const citFile = cit?.file || cit?.file_path || ''
                              const citStart = cit?.start_line || cit?.start || 0
                              const citEnd = cit?.end_line || cit?.end || 0
                              return citFile === chunkFile &&
                                     citStart === chunkStart &&
                                     citEnd === chunkEnd
                            })
                          })
                          
                          const citationRate = chunks.length > 0
                            ? Math.round((citedChunks.length / chunks.length) * 100)
                            : 0
                          
                          // Only show metrics if we have citations or chunks
                          if (citations.length === 0 && chunks.length === 0) {
                            return null
                          }
                          
                          return (
                            <div className="text-[10px] space-y-1 pt-1 border-t border-slate-700/50">
                              {citations.length > 0 && (
                                <div className="flex items-center gap-2 text-slate-400">
                                  <span className="font-semibold">Citation Accuracy:</span>
                                  <span className={
                                    citationAccuracy >= 90 ? 'text-emerald-400' : 
                                    citationAccuracy >= 70 ? 'text-yellow-400' : 
                                    'text-red-400'
                                  }>
                                    {citationAccuracy}%
                                  </span>
                                  <span className="text-slate-500">
                                    ({validCitations.length}/{citations.length} valid)
                                  </span>
                                </div>
                              )}
                              {chunks.length > 0 && (
                                <div className="flex items-center gap-3 text-slate-400">
                                  <span>
                                    <span className="font-semibold">Citation Rate:</span>{' '}
                                    <span className="text-cyan-400">{citationRate}%</span>
                                    <span className="text-slate-500 ml-1">
                                      ({citedChunks.length}/{chunks.length} chunks cited)
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        } catch (error) {
                          console.error('Error calculating metrics:', error)
                          return null
                        }
                      })()}
                    </div>
                  )}
                </div>
                {msg.outputHash && (
                  <div className="text-[10px] font-mono text-slate-600 shrink-0" title={`Output Hash: ${msg.outputHash}`}>
                    {msg.outputHash.slice(0, 6)}...
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {loading && <div className="text-xs text-slate-500 animate-pulse">Atlas is thinking...</div>}
        <div ref={bottomRef} />
          </>
        )}
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
