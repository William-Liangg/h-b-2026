import { useState, useEffect } from 'react'
import { authHeaders, API_URL } from '../auth'
import { USE_MOCKS } from '../mocks/useMockMode'
import { mockOnboardingSteps } from '../mocks/mockData'

export default function OnboardingWalkthrough({ repoId, onHighlight, onNodeClick }) {
  const [steps, setSteps] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!repoId) return

    // MOCK MODE: Use mock onboarding steps
    if (USE_MOCKS) {
      setSteps(mockOnboardingSteps)
      setCurrentStep(0)
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`${API_URL}/onboarding/${repoId}`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).detail || 'Failed to load onboarding')
        return res.json()
      })
      .then((data) => {
        setSteps(data.steps || [])
        setCurrentStep(0)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [repoId])

  // Highlight the current step's file in the graph
  useEffect(() => {
    if (steps.length > 0 && steps[currentStep]) {
      onHighlight?.([steps[currentStep].file])
    }
  }, [currentStep, steps, onHighlight])

  if (loading) {
    return (
      <div className="p-4 text-sm text-zinc-400 flex items-center gap-2">
        <svg className="animate-spin h-4 w-4 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Building onboarding path...
      </div>
    )
  }

  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>
  if (steps.length === 0) return <div className="p-4 text-sm text-zinc-500">No onboarding path available.</div>

  const step = steps[currentStep]

  return (
    <div className="flex flex-col h-full bg-zinc-950" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Onboarding</h3>
        <span className="text-xs text-zinc-500">
          {currentStep + 1} / {steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300 rounded-full"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        <button
          onClick={() => onNodeClick?.(step.file)}
          className="text-sm font-semibold text-white hover:text-cyan-400 transition-colors text-left"
        >
          {step.file}
        </button>

        <div className="text-xs text-zinc-400 leading-relaxed">{step.summary}</div>

        {step.reason && (
          <div className="text-xs bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-3 py-2 text-cyan-300">
            {step.reason}
          </div>
        )}

        {step.responsibilities?.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500 font-semibold">Key responsibilities</div>
            <ul className="text-xs text-zinc-400 space-y-1">
              {step.responsibilities.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-zinc-600 shrink-0">-</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step.key_exports?.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-500 font-semibold">Key exports</div>
            <div className="flex flex-wrap gap-1.5">
              {step.key_exports.map((e, i) => (
                <span key={i} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-lg font-mono border border-zinc-700">
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Step dots */}
        <div className="flex gap-1.5 pt-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStep ? 'bg-cyan-400' : i < currentStep ? 'bg-cyan-800' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-zinc-800 flex gap-2">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={currentStep === steps.length - 1}
          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 text-zinc-950 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
