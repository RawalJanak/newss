import { useState } from 'react'

const KEY = 'mynews-onboarded'

function readOnboarded() {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}

// Explains the two non-obvious interactions the constellation IA introduces:
// dragging a category blob to filter, and zooming into dust to read briefs/
// wire. Spec §7 calls this out explicitly as required, not optional polish.
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
      <p>Zoom into the dim dust near a star — it brightens into today's briefs and wire.</p>
      <button onClick={dismiss}>Got it</button>
    </div>
  )
}
