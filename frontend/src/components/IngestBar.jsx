import { useState } from 'react'
import { authHeaders } from '../auth'

export default function IngestBar({ onIngested }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setStatus('Cloning & indexing...')
    try {
      const res = await fetch('/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Ingest failed')
      }
      const data = await res.json()
      setStatus(`Indexed ${data.files} files, ${data.chunks} chunks`)
      onIngested(data.repo_id)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-3 px-4 py-3">
      <span className="text-lg font-bold text-cyan-400 tracking-wide">ATLAS</span>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
      >
        {loading ? 'Processing...' : 'Analyze'}
      </button>
      {status && <span className="text-xs text-slate-400">{status}</span>}
    </form>
  )
}
