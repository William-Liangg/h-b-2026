import { useState, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AuthProvider, useAuth, authHeaders } from './auth'
import IngestBar from './components/IngestBar'
import IngestProgress from './components/IngestProgress'
import RepoChooser from './components/RepoChooser'
import GraphPanel from './components/GraphPanel'
import ChatPanel from './components/ChatPanel'
import SourcePanel from './components/SourcePanel'
import OnboardingWalkthrough from './components/OnboardingWalkthrough'
import OnboardingGraph from './components/OnboardingGraph'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

// Mock mode for fast frontend iteration
import { USE_MOCKS } from './mocks/useMockMode'
import { MOCK_REPO_ID, mockGraphData, mockSourceView, mockOnboardingSteps } from './mocks/mockData'

function Dashboard() {
  const { email, logout } = useAuth()
  const [repoId, setRepoId] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [highlightedFiles, setHighlightedFiles] = useState([])
  const [sourceView, setSourceView] = useState(null)
  const [manualUrl, setManualUrl] = useState('')
  const [onboardingSteps, setOnboardingSteps] = useState([])
  const [auxiliaryNodes, setAuxiliaryNodes] = useState({})
  const [selectedNodeForAtlas, setSelectedNodeForAtlas] = useState(null)

  // Ingest progress state
  const [ingesting, setIngesting] = useState(false)
  const [ingestStep, setIngestStep] = useState('')
  const [ingestMessage, setIngestMessage] = useState('')
  const [ingestError, setIngestError] = useState('')

  const startIngest = useCallback(async (url) => {
    if (!url.trim() || ingesting) return

    // MOCK MODE: Skip API calls, instantly load mock data
    if (USE_MOCKS) {
      setGraphData(mockGraphData)
      setRepoId(MOCK_REPO_ID)
      setOnboardingSteps(mockOnboardingSteps)
      return
    }

    setIngesting(true)
    setIngestStep('cloning')
    setIngestMessage('Starting...')
    setIngestError('')

    try {
      const res = await fetch('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!res.ok) {
        // Non-streaming error (e.g. 401)
        const err = await res.json().catch(() => ({ detail: 'Ingest failed' }))
        setIngestError(err.detail || 'Ingest failed')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6))
              if (eventType === 'progress') {
                setIngestStep(data.step)
                setIngestMessage(data.message)
              } else if (eventType === 'error') {
                setIngestError(data.message)
              } else if (eventType === 'done') {
                // Ingest complete — fetch graph and onboarding path
                const graphRes = await fetch(`/graph/${data.repo_id}`, { headers: authHeaders() })
                const graphJson = await graphRes.json()
                setGraphData(graphJson)
                setRepoId(data.repo_id)
                
                // Fetch onboarding path
                fetch(`/onboarding/${data.repo_id}`, { headers: authHeaders() })
                  .then(async (res) => {
                    if (res.ok) {
                      const onboardingData = await res.json()
                      setOnboardingSteps(onboardingData.steps || [])
                    }
                  })
                  .catch(err => console.error('Failed to fetch onboarding path:', err))
              }
            } catch { /* ignore parse errors */ }
            eventType = ''
          }
        }
      }
    } catch (err) {
      setIngestError(err.message || 'Network error')
    } finally {
      setIngesting(false)
    }
  }, [ingesting])

  const handleCitations = useCallback((citations) => {
    setHighlightedFiles(citations.map(c => c.file))
  }, [])

  const handleNodeClick = useCallback(async (fileId) => {
    if (!repoId) return

    // MOCK MODE: Use mock source view
    if (USE_MOCKS) {
      setSourceView({ ...mockSourceView, file: fileId })
      return
    }

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

  // Handle node selection for Atlas exploration
  const handleNodeSelect = useCallback((nodeData) => {
    setSelectedNodeForAtlas(nodeData)
  }, [])

  // Handle auxiliary nodes response from Atlas
  const handleAuxiliaryNodes = useCallback((fileId, nodes) => {
    setAuxiliaryNodes(prev => ({
      ...prev,
      [fileId]: nodes
    }))
  }, [])

  // Clear selected node after processing
  const handleSelectedNodeProcessed = useCallback(() => {
    setSelectedNodeForAtlas(null)
  }, [])

  // Load graph and onboarding data when repoId changes (e.g., on page refresh)
  useEffect(() => {
    if (!repoId || USE_MOCKS) return

    // Load graph data
    fetch(`/graph/${repoId}`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.ok) {
          const graphJson = await res.json()
          setGraphData(graphJson)
        }
      })
      .catch(err => console.error('Failed to fetch graph:', err))

    // Load onboarding path
    fetch(`/onboarding/${repoId}`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.ok) {
          const onboardingData = await res.json()
          setOnboardingSteps(onboardingData.steps || [])
        }
      })
      .catch(err => console.error('Failed to fetch onboarding path:', err))
  }, [repoId])

  // Three possible screens: repo chooser, ingest progress, or main workspace
  const renderContent = () => {
    // Screen 1: Ingesting — full-screen progress
    if (ingesting || ingestError) {
      return (
        <IngestProgress
          currentStep={ingestStep}
          message={ingestMessage}
          error={ingestError}
        />
      )
    }

    // Screen 2: Main workspace (post-ingest)
    if (repoId) {
      return (
        <div className="flex-1 flex min-h-0">
          {/* Left sidebar: Step-by-step walkthrough */}
          <div className="w-72 border-r border-zinc-800 flex flex-col min-h-0">
            <OnboardingWalkthrough
              repoId={repoId}
              onHighlight={setHighlightedFiles}
              onNodeClick={handleNodeClick}
            />
          </div>
          {/* Center: Obsidian-style onboarding graph */}
          <div className="flex-1 border-r border-zinc-800">
            <OnboardingGraph
              steps={onboardingSteps}
              highlightedFiles={highlightedFiles}
              onNodeClick={handleNodeClick}
              onNodeSelect={handleNodeSelect}
              auxiliaryNodes={auxiliaryNodes}
            />
          </div>
          {/* Right sidebar: Chat + Source */}
          <div className="w-[400px] flex flex-col min-h-0">
            <div className="flex-1 min-h-0 border-b border-zinc-800">
              <ChatPanel
                repoId={repoId}
                onCitations={handleCitations}
                onCitationClick={handleCitationClick}
                selectedNode={selectedNodeForAtlas}
                onSelectedNodeProcessed={handleSelectedNodeProcessed}
                onAuxiliaryNodes={handleAuxiliaryNodes}
              />
            </div>
            {sourceView && (
              <div className="h-64 overflow-auto">
                <SourcePanel data={sourceView} onClose={() => setSourceView(null)} />
              </div>
            )}
          </div>
        </div>
      )
    }

    // Screen 3: Repo chooser (default after login)
    return (
      <div className="flex-1 overflow-auto bg-zinc-950 px-8 py-12">
        <div className="max-w-5xl mx-auto space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Select a repository</h2>
            <p className="text-sm text-zinc-500">Choose a repo to analyze or paste a URL below</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <form
              onSubmit={(e) => { e.preventDefault(); if (manualUrl.trim()) startIngest(manualUrl.trim()) }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 h-12 px-4 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="submit"
                className="h-12 px-6 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-sm font-semibold rounded-xl transition-colors"
              >
                Analyze
              </button>
            </form>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
            <div className="relative flex justify-center"><span className="bg-zinc-950 px-4 text-sm text-zinc-600">or choose from your repos</span></div>
          </div>
          <RepoChooser onSelect={(url) => startIngest(url)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="flex items-center justify-between bg-zinc-950 border-b border-zinc-800 px-5 h-14">
        <div className="flex items-center gap-4">
          <button onClick={() => { setRepoId(null); setGraphData(null); setOnboardingSteps([]) }} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-zinc-950 font-bold text-sm">A</div>
            <span className="text-white font-semibold text-sm">ATLAS</span>
          </button>
          {repoId && (
            <button
              onClick={() => { setRepoId(null); setGraphData(null); setOnboardingSteps([]) }}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg px-3 py-1.5 hover:border-zinc-600 transition-colors"
            >
              Switch repo
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500">{email}</span>
          <button onClick={logout} className="text-xs text-zinc-500 hover:text-white transition-colors">
            Logout
          </button>
        </div>
      </div>
      {renderContent()}
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/app" replace /> : <SignupPage />} />
      <Route path="/app" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} />
      <Route path="/" element={isAuthenticated ? <Navigate to="/app" replace /> : <LandingPage />} />
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
