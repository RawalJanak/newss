import { describe, it, expect } from 'vitest'
import { pickRenderTier } from './device.js'

describe('pickRenderTier', () => {
  it('picks mobile below the 760px breakpoint regardless of other factors', () => {
    expect(pickRenderTier({ width: 390, reducedMotion: false, hardwareConcurrency: 16 })).toBe('mobile')
  })

  it('picks reduced when prefers-reduced-motion is set, even on a wide/capable screen', () => {
    expect(pickRenderTier({ width: 1440, reducedMotion: true, hardwareConcurrency: 16 })).toBe('reduced')
  })

  it('picks reduced on a wide screen with low hardware concurrency', () => {
    expect(pickRenderTier({ width: 1440, reducedMotion: false, hardwareConcurrency: 2 })).toBe('reduced')
  })

  it('picks full on a wide, capable, motion-enabled screen', () => {
    expect(pickRenderTier({ width: 1440, reducedMotion: false, hardwareConcurrency: 8 })).toBe('full')
  })

  it('treats exactly 760px as desktop, not mobile', () => {
    expect(pickRenderTier({ width: 760, reducedMotion: false, hardwareConcurrency: 8 })).not.toBe('mobile')
  })
})
