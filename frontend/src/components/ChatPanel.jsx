import { useState, useRef, useEffect } from 'react'
import { authHeaders, API_URL } from '../auth'
import { USE_MOCKS } from '../mocks/useMockMode'
import { mockQueryResponse } from '../mocks/mockData'

export default function ChatPanel({ repoId, onCitations, onCitationClick, selectedNode, onSelectedNodeProcessed, onAuxiliaryNodes }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' or 'chunks-{messageIndex}'
  const [openChunksTabs, setOpenChunksTabs] = useState({}) // Map of messageIndex -> chunks data
  const [nodeContext, setNodeContext] = useState(null) // Currently selected node context
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // When a node is selected from the graph, add it as context (don't auto-prompt)
  useEffect(() => {
    if (!selectedNode) return
    setNodeContext(selectedNode)
    onSelectedNodeProcessed?.()
  }, [selectedNode, onSelectedNodeProcessed])

  // Clear context handler
  const clearNodeContext = () => {
    setNodeContext(null)
  }

  // Find related files/nodes for the current context
  const findRelatedNodes = async () => {
    if (!nodeContext || loading) return

    const structuredPrompt = `For the file "${nodeContext.file}", identify the most important related files in this codebase.

IMPORTANT: Format your response as a structured list. For each related file, use EXACTLY this format:
RELATED_FILE: <filepath> | <relationship_type> | <description>

Where relationship_type is one of: imports, imported_by, calls, called_by, extends, implements, configures, tests, documents

Example format:
RELATED_FILE: src/utils/auth.js | imports | Provides authentication helpers used in this file
RELATED_FILE: src/components/Header.jsx | imported_by | Consumes the exports from this file

List 3-5 of the most important related files. Be specific with file paths.`

    setMessages((prev) => [...prev, {
      role: 'user',
      content: `🔗 Finding related files for: ${nodeContext.file}`,
      nodeContext: nodeContext.file,
      isRelatedSearch: true
    }])
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          repo_id: repoId,
          question: structuredPrompt,
          context: {
            file: nodeContext.file,
            summary: nodeContext.summary,
            responsibilities: nodeContext.responsibilities,
            key_exports: nodeContext.key_exports,
            dependencies: nodeContext.dependencies,
          }
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Query failed')

      // Parse structured response for related files
      const auxNodes = parseStructuredRelatedFiles(data.answer, nodeContext.file)
      if (auxNodes.length > 0) {
        onAuxiliaryNodes?.(nodeContext.file, auxNodes)
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          chunks: data.chunks,
          outputHash: data.output_hash,
          nodeContext: nodeContext.file,
          addedNodes: auxNodes.length,
        },
      ])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  // Parse structured RELATED_FILE: responses
  const parseStructuredRelatedFiles = (answer, sourceFile) => {
    const nodes = []
    const seenFiles = new Set()

    // Match RELATED_FILE: filepath | type | description
    const pattern = /RELATED_FILE:\s*([^\s|]+)\s*\|\s*([^|]+)\s*\|\s*([^\n]+)/gi
    let match

    while ((match = pattern.exec(answer)) !== null) {
      const filepath = match[1].trim()
      const relationType = match[2].trim()
      const description = match[3].trim()

      if (!seenFiles.has(filepath) && filepath !== sourceFile) {
        seenFiles.add(filepath)
        nodes.push({
          label: filepath.split('/').pop(), // filename only for display
          type: relationType,
          targetFile: filepath,
          description: description
        })
      }
    }

    // Fallback: try to find any file paths mentioned if structured format wasn't used
    if (nodes.length === 0) {
      const fallbackPattern = /(?:^|\s)([a-zA-Z0-9_\-/.]+\/[a-zA-Z0-9_\-/.]+\.(py|js|ts|tsx|jsx|go|rs|java|cpp|c|h|json|yaml|yml|md))/gm
      while ((match = fallbackPattern.exec(answer)) !== null) {
        const filepath = match[1].trim()
        if (!seenFiles.has(filepath) && filepath !== sourceFile && !filepath.startsWith('http')) {
          seenFiles.add(filepath)
          nodes.push({
            label: filepath.split('/').pop(),
            type: 'Related',
            targetFile: filepath,
            description: 'Mentioned in response'
          })
        }
      }
    }

    return nodes.slice(0, 6) // Limit to 6 nodes
  }

  // Parse auxiliary nodes from Atlas response
  const parseAuxiliaryNodes = (answer, sourceFile) => {
    const nodes = []

    // Look for file references in the answer
    const filePattern = /(?:file|module|see|check|look at|refers to|imports?|depends on)\s*[`"]?([a-zA-Z0-9_\-/.]+\.(py|js|ts|tsx|jsx|go|rs|java|cpp|c|h))[`"]?/gi
    let match
    const seenFiles = new Set()

    while ((match = filePattern.exec(answer)) !== null) {
      const file = match[1]
      if (!seenFiles.has(file) && file !== sourceFile) {
        seenFiles.add(file)
        nodes.push({
          label: file.split('/').pop(),
          type: 'Related',
          targetFile: file,
          description: 'Referenced in Atlas response'
        })
      }
    }

    // Look for concept patterns
    const conceptPatterns = [
      /(?:key concept|important pattern|architecture|design pattern)[:\s]+["']?([^"'\n.]+)["']?/gi,
      /(?:uses?|implements?|follows?)\s+(?:the\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s+(?:pattern|principle|approach)/gi,
    ]

    const seenConcepts = new Set()
    for (const pattern of conceptPatterns) {
      while ((match = pattern.exec(answer)) !== null) {
        const concept = match[1].trim()
        if (!seenConcepts.has(concept.toLowerCase()) && concept.length < 40) {
          seenConcepts.add(concept.toLowerCase())
          nodes.push({
            label: concept,
            type: 'Concept',
            description: 'Key concept identified'
          })
        }
      }
    }

    // Look for gotchas/warnings
    const gotchaPattern = /(?:gotcha|warning|watch out|careful|note|important)[:\s]+([^.]+)/gi
    while ((match = gotchaPattern.exec(answer)) !== null) {
      const gotcha = match[1].trim()
      if (gotcha.length > 10 && gotcha.length < 60) {
        nodes.push({
          label: gotcha.substring(0, 40) + (gotcha.length > 40 ? '...' : ''),
          type: 'Warning',
          description: gotcha
        })
        break // Only take first gotcha
      }
    }

    return nodes.slice(0, 5) // Limit to 5 auxiliary nodes
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')

    // Build user message with context indicator if present
    const userMessage = nodeContext
      ? { role: 'user', content: question, nodeContext: nodeContext.file }
      : { role: 'user', content: question }
    setMessages((prev) => [...prev, userMessage])
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

    // Build request body with optional node context
    const requestBody = { repo_id: repoId, question }
    if (nodeContext) {
      requestBody.context = {
        file: nodeContext.file,
        summary: nodeContext.summary,
        responsibilities: nodeContext.responsibilities,
        key_exports: nodeContext.key_exports,
        dependencies: nodeContext.dependencies,
      }
    }

    try {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(requestBody),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Query failed')
      
      // Extract citations from answer text if backend didn't provide them
      let citations = data.citations || []
      
      // Debug: log what we got from backend
      console.log('Backend response:', {
        hasCitations: !!data.citations,
        citationsCount: data.citations?.length || 0,
        answerPreview: data.answer?.substring(0, 200),
        fullAnswer: data.answer
      })
      
      if (citations.length === 0 && data.answer) {
        // Fallback: extract citations from answer text using regex
        // Handle nested brackets and different formats
        const extracted = []
        
        // Pattern 1: [file:start-end] or [file:line] - handles nested brackets by matching from : to ]
        // This matches [anything:number-number] or [anything:number]
        const citationPattern = /\[([^\]]+):(\d+)(?:-(\d+))?\]/g
        let match
        while ((match = citationPattern.exec(data.answer)) !== null) {
          const file = match[1].trim()
          const start = parseInt(match[2])
          const end = match[3] ? parseInt(match[3]) : start // If no end, use start as end
          
          // Avoid duplicates
          const key = `${file}:${start}-${end}`
          if (!extracted.find(c => `${c.file}:${c.start_line}-${c.end_line}` === key)) {
            extracted.push({
              file: file,
              start_line: start,
              end_line: end
            })
          }
        }
        
        if (extracted.length > 0) {
          citations = extracted
          console.log('✅ Extracted citations from answer text:', extracted)
        } else {
          console.log('❌ No citations found in answer text. Answer:', data.answer)
        }
      } else if (citations.length > 0) {
        console.log('✅ Using citations from backend:', citations)
      }

      // Extract auxiliary nodes from response when we have node context
      if (nodeContext && data.answer) {
        const auxNodes = parseAuxiliaryNodes(data.answer, nodeContext.file)
        if (auxNodes.length > 0) {
          onAuxiliaryNodes?.(nodeContext.file, auxNodes)
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: citations,
          chunks: data.chunks, // Store chunks for display
          outputHash: data.output_hash, // Store hash for determinism display
          citationValidation: data.citation_validation, // Citation accuracy metrics
          retrievalMetrics: data.retrieval_metrics, // Retrieval quality metrics
          nodeContext: nodeContext?.file, // Track which node this response was about
        },
      ])
      onCitations?.(citations || [])
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
    <div className="flex flex-col h-full bg-zinc-950" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Tab Bar */}
      <div className="flex items-center border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 ${
            activeTab === 'chat'
              ? 'text-cyan-400 border-b-2 border-cyan-400 bg-zinc-900/50'
              : 'text-zinc-500 hover:text-zinc-300'
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
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-300'
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
                    const remainingTabs = Object.keys(newTabs)
                    if (remainingTabs.length > 0) {
                      setActiveTab(`chunks-${remainingTabs[0]}`)
                    } else {
                      setActiveTab('chat')
                    }
                  }
                }}
                className="px-1 py-1 text-xs text-zinc-500 hover:text-zinc-300"
                title="Close chunks tab"
              >
                ×
              </button>
            </div>
          )
        })}
        {activeTab === 'chat' && messages.length > 0 && messages[messages.length - 1]?.outputHash && (
          <span className="ml-auto text-[10px] normal-case font-mono text-zinc-600 px-3 shrink-0">
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
                <div className="text-xs font-semibold text-zinc-400 mb-2">
                  Retrieved Chunks from Response {messageIndex + 1} ({chunksData.length})
                </div>
                {chunksData.map((chunk, j) => (
                  <div key={j} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="text-cyan-400 font-mono text-xs mb-2 font-semibold">
                      {chunk.file || chunk.file_path}:{chunk.start_line || chunk.start}-{chunk.end_line || chunk.end}
                    </div>
                    <div className="text-zinc-200 text-sm font-mono whitespace-pre-wrap overflow-x-auto bg-zinc-950 p-2 rounded-lg border border-zinc-800 max-h-96 overflow-y-auto">
                      <pre className="m-0 font-mono text-xs leading-relaxed">{chunk.text}</pre>
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
          const hasNodeContext = !!msg.nodeContext

          return (
            <div key={i} className={`text-sm ${isUser ? 'text-zinc-300' : 'text-zinc-100'} ${hasNodeContext ? 'border-l-2 border-purple-500 pl-3' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {hasNodeContext && isUser && (
                    <div className="text-[10px] text-purple-400 mb-1 flex items-center gap-1">
                      <span>📎</span>
                      <span className="opacity-75">Context: {msg.nodeContext}</span>
                    </div>
                  )}
                  <span className={`font-semibold ${isUser ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {isUser ? 'You' : 'Atlas'}:
                  </span>{' '}
                  <span className="whitespace-pre-wrap">{renderContent(msg.content, msg.citations)}</span>
                  {!isUser && msg.addedNodes > 0 && (
                    <div className="mt-2 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                      <span>✨</span>
                      <span>Added {msg.addedNodes} node{msg.addedNodes > 1 ? 's' : ''} to graph</span>
                    </div>
                  )}
                  {!isUser && (msg.chunks?.length > 0 || msg.citations?.length > 0) && (
                    <div className="mt-2 space-y-2">
                      <button
                        onClick={() => {
                          if (msg.chunks && msg.chunks.length > 0) {
                            setOpenChunksTabs(prev => ({
                              ...prev,
                              [i]: msg.chunks
                            }))
                            setActiveTab(`chunks-${i}`)
                          }
                        }}
                        disabled={!msg.chunks || msg.chunks.length === 0}
                        className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-300 rounded-lg border border-zinc-700 transition-colors"
                      >
                        {openChunksTabs[i] ? 'View' : 'Show'} Retrieved Chunks ({msg.chunks?.length || 0})
                      </button>
                      {/* Simple metrics calculated on frontend */}
                      {(() => {
                        try {
                          const chunks = msg.chunks || []
                          const citations = msg.citations || []
                          
                          // Helper to normalize file paths (handle full paths vs filenames)
                          const normalizeFilePath = (filePath) => {
                            if (!filePath) return ''
                            const normalized = String(filePath).trim()
                            // Extract just the filename for comparison
                            const filename = normalized.split('/').pop() || normalized
                            return { full: normalized, filename }
                          }
                          
                          // Helper to create a key for comparison
                          const getChunkKey = (item, useFullPath = true) => {
                            if (!item) return ''
                            const fileInfo = normalizeFilePath(item.file || item.file_path || '')
                            const file = useFullPath ? fileInfo.full : fileInfo.filename
                            // Convert to number to handle string/number mismatches
                            const start = Number(item.start_line ?? item.start ?? 0)
                            const end = Number(item.end_line ?? item.end ?? 0)
                            return `${file}:${start}-${end}`
                          }
                          
                          // Create chunk keys with both full path and filename for flexible matching
                          const chunkKeysFull = new Set(chunks.map(c => getChunkKey(c, true)))
                          const chunkKeysFilename = new Set(chunks.map(c => getChunkKey(c, false)))
                          
                          // Also create a map for line range matching
                          const chunkMap = new Map()
                          chunks.forEach(chunk => {
                            const fileInfo = normalizeFilePath(chunk.file || chunk.file_path || '')
                            const key = `${fileInfo.filename}:${chunk.start_line}-${chunk.end_line}`
                            if (!chunkMap.has(key)) {
                              chunkMap.set(key, [])
                            }
                            chunkMap.get(key).push(chunk)
                          })
                          
                          // Calculate citation accuracy: how many citations match retrieved chunks
                          const validCitations = citations.filter(cit => {
                            const citKeyFull = getChunkKey(cit, true)
                            const citKeyFilename = getChunkKey(cit, false)
                            
                            // Try exact match first (full path)
                            if (chunkKeysFull.has(citKeyFull)) {
                              return true
                            }
                            
                            // Try filename match
                            if (chunkKeysFilename.has(citKeyFilename)) {
                              return true
                            }
                            
                            // Try line range matching: check if citation line range overlaps with any chunk
                            const citFileInfo = normalizeFilePath(cit.file || cit.file_path || '')
                            const citStart = Number(cit.start_line ?? cit.start ?? 0)
                            const citEnd = Number(cit.end_line ?? cit.end ?? 0)
                            
                            const matchingChunks = chunkMap.get(`${citFileInfo.filename}:${citStart}-${citEnd}`)
                            if (matchingChunks && matchingChunks.length > 0) {
                              return true
                            }
                            
                            // Check if citation line range is within any chunk's range
                            const chunksWithSameFile = chunks.filter(chunk => {
                              const chunkFileInfo = normalizeFilePath(chunk.file || chunk.file_path || '')
                              return chunkFileInfo.filename === citFileInfo.filename
                            })
                            
                            const overlaps = chunksWithSameFile.some(chunk => {
                              const chunkStart = Number(chunk.start_line ?? chunk.start ?? 0)
                              const chunkEnd = Number(chunk.end_line ?? chunk.end ?? 0)
                              // Check if citation range overlaps with chunk range
                              return citStart <= chunkEnd && citEnd >= chunkStart
                            })
                            
                            if (!overlaps) {
                              // Debug: log mismatches
                              console.log('Citation mismatch:', {
                                citation: citKeyFilename,
                                citationFull: citKeyFull,
                                availableChunks: Array.from(chunkKeysFilename),
                                citationData: cit
                              })
                            }
                            
                            return overlaps
                          })
                          
                          const citationAccuracy = citations.length > 0 
                            ? Math.round((validCitations.length / citations.length) * 100)
                            : 100
                          
                          // Calculate citation rate: how many chunks were cited
                          const citedChunks = chunks.filter(chunk => {
                            const chunkFileInfo = normalizeFilePath(chunk.file || chunk.file_path || '')
                            const chunkStart = Number(chunk.start_line ?? chunk.start ?? 0)
                            const chunkEnd = Number(chunk.end_line ?? chunk.end ?? 0)
                            
                            return citations.some(cit => {
                              const citFileInfo = normalizeFilePath(cit.file || cit.file_path || '')
                              const citStart = Number(cit.start_line ?? cit.start ?? 0)
                              const citEnd = Number(cit.end_line ?? cit.end ?? 0)
                              
                              // Match by filename and overlapping line ranges
                              if (chunkFileInfo.filename !== citFileInfo.filename) {
                                return false
                              }
                              
                              // Check if citation range overlaps with chunk range
                              return citStart <= chunkEnd && citEnd >= chunkStart
                            })
                          })
                          
                          const citationRate = chunks.length > 0
                            ? Math.round((citedChunks.length / chunks.length) * 100)
                            : 0
                          
                          // Debug log
                          console.log('Metrics calculation:', {
                            chunksCount: chunks.length,
                            citationsCount: citations.length,
                            validCitationsCount: validCitations.length,
                            citedChunksCount: citedChunks.length,
                            citationAccuracy,
                            citationRate,
                            sampleChunk: chunks[0],
                            sampleCitation: citations[0],
                            allCitations: citations,
                            allChunkFiles: chunks.map(c => {
                              const fileInfo = normalizeFilePath(c.file || c.file_path || '')
                              return `${fileInfo.filename}:${c.start_line}-${c.end_line}`
                            })
                          })
                          
                          // Only show metrics if we have citations or chunks
                          if (citations.length === 0 && chunks.length === 0) {
                            return null
                          }
                          
                          return (
                            <div className="text-[10px] space-y-1 pt-1 border-t border-zinc-800">
                              {citations.length > 0 && (
                                <div className="flex items-center gap-2 text-zinc-400">
                                  <span className="font-semibold">Citation Accuracy:</span>
                                  <span className={
                                    citationAccuracy >= 90 ? 'text-emerald-400' : 
                                    citationAccuracy >= 70 ? 'text-yellow-400' : 
                                    'text-red-400'
                                  }>
                                    {citationAccuracy}%
                                  </span>
                                  <span className="text-zinc-500">
                                    ({validCitations.length}/{citations.length} valid)
                                  </span>
                                </div>
                              )}
                              {chunks.length > 0 && (
                                <div className="flex items-center gap-3 text-zinc-400">
                                  <span>
                                    <span className="font-semibold">Citation Rate:</span>{' '}
                                    <span className="text-cyan-400">{citationRate}%</span>
                                    <span className="text-zinc-500 ml-1">
                                      ({citedChunks.length}/{chunks.length} chunks cited)
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        } catch (error) {
                          console.error('Error calculating metrics:', error, { 
                            chunks: msg.chunks, 
                            citations: msg.citations,
                            errorMessage: error.message,
                            errorStack: error.stack
                          })
                          return (
                            <div className="text-[10px] text-red-400 pt-1 border-t border-zinc-800">
                              Error calculating metrics: {error.message}
                            </div>
                          )
                        }
                      })()}
                    </div>
                  )}
                </div>
                {msg.outputHash && (
                  <div className="text-[10px] font-mono text-zinc-600 shrink-0" title={`Output Hash: ${msg.outputHash}`}>
                    {msg.outputHash.slice(0, 6)}...
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {loading && <div className="text-xs text-zinc-500 animate-pulse">Atlas is thinking...</div>}
        <div ref={bottomRef} />
          </>
        )}
      </div>
      {/* Node Context Pill - shows when a node is selected */}
      {nodeContext && (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 text-xs">
              <span className="text-purple-400">📎</span>
              <span className="text-zinc-400">Context:</span>
              <span className="text-purple-300 font-medium truncate">{nodeContext.file}</span>
            </div>
            <button
              onClick={findRelatedNodes}
              disabled={loading}
              className="text-purple-400 hover:text-purple-300 disabled:text-zinc-600 text-xs px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 disabled:bg-transparent border border-purple-500/30 hover:border-purple-500/50 disabled:border-zinc-700 transition-colors flex items-center gap-1"
              title="Find related files and add them to the graph"
            >
              <span>🔗</span>
              <span>Find related</span>
            </button>
            <button
              onClick={clearNodeContext}
              className="text-zinc-500 hover:text-zinc-300 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors"
              title="Remove context"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-zinc-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={nodeContext ? `Ask about ${nodeContext.file}...` : "Hey Atlas, how does X work?"}
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-700 text-zinc-950 text-sm font-semibold rounded-xl transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
