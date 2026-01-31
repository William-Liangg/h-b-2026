import { useState, useEffect } from 'react'
import { authHeaders, useAuth } from '../auth'

function FolderIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function RepoChooser({ onSelect }) {
  const { isAuthenticated } = useAuth()
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      setError('Please log in to view your repositories')
      return
    }
    
    let cancelled = false
    const headers = authHeaders()
    if (!headers.Authorization) {
      setLoading(false)
      setError('Authentication token missing. Please log in again.')
      return
    }
    
    fetch('/github/repos', { headers })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          if (res.status === 401) {
            throw new Error('Authentication failed. Please log in again.')
          }
          throw new Error(data.detail || 'Failed to fetch repos')
        }
        return res.json()
      })
      .then((data) => { if (!cancelled) setRepos(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-2 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading your repositories...
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-slate-500 text-sm">{error}</div>
  }

  if (repos.length === 0) {
    return <div className="text-center py-12 text-slate-500 text-sm">No repositories found.</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {repos.map((repo) => (
        <button
          key={repo.full_name}
          onClick={() => onSelect(repo.html_url)}
          className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-cyan-500/50 hover:bg-slate-800 transition-all text-left group"
        >
          <FolderIcon className="w-8 h-8 text-cyan-400 shrink-0 mt-0.5 group-hover:text-cyan-300 transition-colors" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-200 truncate">{repo.name}</div>
            {repo.description && (
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{repo.description}</div>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
              {repo.language && <span className="text-slate-400">{repo.language}</span>}
              <span>{timeAgo(repo.updated_at)}</span>
              {repo.private && <span className="text-amber-500/70">private</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
