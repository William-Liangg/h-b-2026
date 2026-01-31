export default function SourcePanel({ data, onClose }) {
  if (!data) return null

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-xs font-mono text-cyan-400">
          {data.file}:{data.start}-{data.end}
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">
          Close
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-xs font-mono leading-5">
        {data.lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-10 text-right pr-3 text-slate-600 select-none shrink-0">
              {data.start + i}
            </span>
            <span className="text-slate-200">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
