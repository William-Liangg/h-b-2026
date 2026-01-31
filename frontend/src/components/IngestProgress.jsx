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
    <div className="flex-1 flex items-center justify-center bg-zinc-950" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Analyzing repository</h2>
          <p className="text-sm text-zinc-500">This usually takes 30–60 seconds</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-700 ease-out rounded-full"
            style={{ width: `${Math.max(5, ((activeIdx + 1) / STEPS.length) * 100)}%` }}
          />
        </div>

        {/* Step list */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          {STEPS.map((step, i) => {
            const isActive = i === activeIdx

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className="w-5 flex justify-center">
                  {i < activeIdx ? (
                    <CheckIcon />
                  ) : isActive ? (
                    <Spinner />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-zinc-700" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive
                      ? 'text-white font-medium'
                      : i < activeIdx
                        ? 'text-zinc-500'
                        : 'text-zinc-600'
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
          <p className="text-xs text-zinc-500 text-center">{message}</p>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-5 py-4 text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
