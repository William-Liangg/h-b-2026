import { useState, useCallback } from 'react'
import IngestBar from './components/IngestBar'
import GraphPanel from './components/GraphPanel'
import ChatPanel from './components/ChatPanel'
import SourcePanel from './components/SourcePanel'

function App() {
  const [repoId, setRepoId] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [highlightedFiles, setHighlightedFiles] = useState([])
  const [sourceView, setSourceView] = useState(null) // {file, start, end, lines}

  const handleIngested = useCallback(async (id) => {
    setRepoId(id)
    const res = await fetch(`/graph/${id}`)
    const data = await res.json()
    setGraphData(data)
  }, [])

  const handleCitations = useCallback((citations) => {
    setHighlightedFiles(citations.map(c => c.file))
  }, [])

  const handleNodeClick = useCallback(async (fileId) => {
    if (!repoId) return
    const res = await fetch(`/source/${repoId}?file=${encodeURIComponent(fileId)}`)
    if (res.ok) {
      const data = await res.json()
      setSourceView(data)
    }
  }, [repoId])

  const handleCitationClick = useCallback(async (citation) => {
    if (!repoId) return
    const res = await fetch(
      `/source/${repoId}?file=${encodeURIComponent(citation.file)}&start=${citation.start_line}&end=${citation.end_line}`
    )
    if (res.ok) {
      const data = await res.json()
      setSourceView(data)
    }
    setHighlightedFiles([citation.file])
  }, [repoId])

  return (
    <div className="h-screen flex flex-col">
      <IngestBar onIngested={handleIngested} />
      {repoId ? (
        <div className="flex-1 flex min-h-0">
          <div className="w-1/2 border-r border-slate-700">
            <GraphPanel
              data={graphData}
              highlightedFiles={highlightedFiles}
              onNodeClick={handleNodeClick}
            />
          </div>
          <div className="w-1/2 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b border-slate-700">
              <ChatPanel
                repoId={repoId}
                onCitations={handleCitations}
                onCitationClick={handleCitationClick}
              />
            </div>
            {sourceView && (
              <div className="h-64 overflow-auto">
                <SourcePanel data={sourceView} onClose={() => setSourceView(null)} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-lg">
          Paste a GitHub repo URL above to get started
        </div>
      )}
    </div>
  )
}

export default App
