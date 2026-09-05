import { useEffect, useState } from 'react'

// Mobile breakpoint matches the rest of the app's CSS (see styles.css).
const MOBILE_BREAKPOINT = 760
const LOW_CONCURRENCY_THRESHOLD = 4

// Pure decision function — takes an explicit env object so it's testable
// without mocking window/navigator. See spec §5 "three render budgets".
export function pickRenderTier({ width, reducedMotion, hardwareConcurrency }) {
  if (width < MOBILE_BREAKPOINT) return 'mobile'
  if (reducedMotion) return 'reduced'
  if (hardwareConcurrency < LOW_CONCURRENCY_THRESHOLD) return 'reduced'
  return 'full'
}

export function useRenderTier() {
  const [tier, setTier] = useState(() => readTier())

  useEffect(() => {
    function onResize() { setTier(readTier()) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return tier
}

function readTier() {
  if (typeof window === 'undefined') return 'mobile'
  return pickRenderTier({
    width: window.innerWidth,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
  })
}
