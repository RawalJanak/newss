import { useState } from 'react'

const KEY = 'mynews-onboarded'

function readOnboarded() {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

// Explains the non-obvious interaction the constellation IA introduces:
// dragging a category blob to filter. Spec §7 calls this out explicitly as
// required, not optional polish.
export default function OnboardingHint() {
  const [dismissed, setDismissed] = useState(readOnboarded)

  if (dismissed) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="onboarding-hint" role="dialog" aria-modal="true">
      <p>Drag a category blob toward the center to filter the sky toward it.</p>
      <p>Click a star to open it and read the full story.</p>
      <button onClick={dismiss}>Got it</button>
    </div>
  )
}
