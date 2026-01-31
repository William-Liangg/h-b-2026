// Toggle this to switch between mock and real API calls
// Set to true for fast frontend iteration, false for real API
export const USE_MOCKS = true

// Helper to log when mocks are active
if (USE_MOCKS) {
  console.log('%c🎭 MOCK MODE ENABLED - Using fake data for fast iteration', 'background: #22d3ee; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold')
}
