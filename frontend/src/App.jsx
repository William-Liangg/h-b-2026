import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, authHeaders } from './auth'
import IngestBar from './components/IngestBar'
import RepoChooser from './components/RepoChooser'
import GraphPanel from './components/GraphPanel'
import ChatPanel from './components/ChatPanel'
import SourcePanel from './components/SourcePanel'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

function Dashboard() {
  const { email, logout } = useAuth()
  const [repoId, setRepoId] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [highlightedFiles, setHighlightedFiles] = useState([])
  const [sourceView, setSourceView] = useState(null)
  const [manualUrl, setManualUrl] = useState('')
  const [ingestingUrl, setIngestingUrl] = useState(null)

  const handleIngested = useCallback(async (id) => {
    setIngestingUrl(null)
    setRepoId(id)
    const res = await fetch(`/graph/${id}`, { headers: authHeaders() })
    const data = await res.json()
    setGraphData(data)
  }, [])

  const handleCitations = useCallback((citations) => {
    setHighlightedFiles(citations.map(c => c.file))
  }, [])

  const handleNodeClick = useCallback(async (fileId) => {
    if (!repoId) return
    const res = await fetch(`/source/${repoId}?file=${encodeURIComponent(fileId)}`, { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json()
      setSourceView(data)
    }
  }, [repoId])

  const handleCitationClick = useCallback(async (citation) => {
    if (!repoId) return
    const res = await fetch(
      `/source/${repoId}?file=${encodeURIComponent(citation.file)}&start=${citation.start_line}&end=${citation.end_line}`,
      { headers: authHeaders() }
    )
    if (res.ok) {
      const data = await res.json()
      setSourceView(data)
    }
    setHighlightedFiles([citation.file])
  }, [repoId])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center bg-slate-800 border-b border-slate-700">
        <IngestBar onIngested={handleIngested} autoUrl={ingestingUrl} />
        <div className="flex items-center gap-3 px-4">
          <span className="text-xs text-slate-400">{email}</span>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Logout
          </button>
        </div>
      </div>
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
        <div className="flex-1 overflow-auto px-8 py-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-4">Choose a repo</h2>
              <RepoChooser onSelect={(url) => { setManualUrl(url); setIngestingUrl(url) }} />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700" /></div>
              <div className="relative flex justify-center"><span className="bg-slate-900 px-3 text-sm text-slate-500">or paste a URL</span></div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (manualUrl.trim()) setIngestingUrl(manualUrl.trim()) }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded transition-colors"
              >
                Analyze
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
