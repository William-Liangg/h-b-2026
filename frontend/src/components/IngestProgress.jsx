const STEPS = [
  { key: 'cloning',   label: 'Cloning repository' },
  { key: 'scanning',  label: 'Scanning files' },
  { key: 'embedding', label: 'Generating embeddings' },
  { key: 'graphing',  label: 'Mapping dependencies' },
  { key: 'analyzing', label: 'Analyzing with AI' },
  { key: 'pathing',   label: 'Generating onboarding path' },
]

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 text-cyan-400 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function IngestProgress({ currentStep, message, error }) {
  const activeIdx = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-slate-200">Analyzing repository</h2>
          <p className="text-xs text-slate-500">This usually takes 30–60 seconds</p>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(5, ((activeIdx + 1) / STEPS.length) * 100)}%` }}
          />
        </div>

        {/* Step list */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const isDone = i < activeIdx || (i === activeIdx && false)
            const isActive = i === activeIdx
            const isPending = i > activeIdx

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className="w-5 flex justify-center">
                  {i < activeIdx ? (
                    <CheckIcon />
                  ) : isActive ? (
                    <Spinner />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive
                      ? 'text-slate-200 font-medium'
                      : i < activeIdx
                        ? 'text-slate-500'
                        : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Live message */}
        {message && !error && (
          <p className="text-xs text-slate-500 text-center">{message}</p>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded px-4 py-3 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
