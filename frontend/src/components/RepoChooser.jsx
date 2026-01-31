import { useState, useEffect } from 'react'
import { authHeaders } from '../auth'
import { USE_MOCKS } from '../mocks/useMockMode'
import { mockRepos } from '../mocks/mockData'

const langColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95', C: '#555555',
  'C++': '#f34b7d', 'C#': '#178600', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Shell: '#89e051', HTML: '#e34c26',
}

function GitBranchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  )
}

function LockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
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
  const [repos, setRepos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (USE_MOCKS) {
      setRepos(mockRepos)
      setLoading(false)
      return
    }

    let cancelled = false
    fetch('/github/repos', { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || 'Failed to fetch repos')
        }
        return res.json()
      })
      .then((data) => { if (!cancelled) setRepos(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-3 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading your repositories...
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-16 text-zinc-500 text-sm">{error}</div>
  }

  if (repos.length === 0) {
    return <div className="text-center py-16 text-zinc-500 text-sm">No repositories found.</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {repos.map((repo) => (
        <button
          key={repo.full_name}
          onClick={() => onSelect(repo.html_url)}
          className="flex items-start gap-4 p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-cyan-500/50 hover:bg-zinc-800/80 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-700 transition-colors">
            <GitBranchIcon className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">{repo.name}</div>
            {repo.description && (
              <div className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">{repo.description}</div>
            )}
            <div className="flex items-center gap-3 mt-3 text-xs text-zinc-600">
              {repo.language && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColors[repo.language] || '#8b8b8b' }} />
                  <span className="text-zinc-400">{repo.language}</span>
                </span>
              )}
              <span>{timeAgo(repo.updated_at)}</span>
              {repo.private && (
                <span className="flex items-center gap-1 text-amber-500/80">
                  <LockIcon className="w-3 h-3" />
                  <span>private</span>
                </span>
              )}
              {repo.stargazers_count > 0 && (
                <span className="text-zinc-500">{repo.stargazers_count}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
