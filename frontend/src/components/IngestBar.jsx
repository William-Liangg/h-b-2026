import { useState } from 'react'

export default function IngestBar({ onIngest, disabled }) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (url.trim() && !disabled) {
      onIngest(url.trim())
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
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white text-sm font-medium rounded transition-colors"
      >
        Analyze
      </button>
    </form>
  )
}
