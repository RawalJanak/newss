import { describe, it, expect } from 'vitest'
import { pullFactor, decayStrength } from './gravityPull.js'

describe('pullFactor', () => {
  it('is neutral (1) when no category is active', () => {
    expect(pullFactor({ itemCategory: 'Sports', activeCategory: null, strength: 1 })).toBe(1)
  })

  it('brightens/pulls an item matching the active category, scaled by strength', () => {
    expect(pullFactor({ itemCategory: 'Sports', activeCategory: 'Sports', strength: 0.5 })).toBe(1.5)
  })

  it('dims a non-matching item, scaled by strength', () => {
    expect(pullFactor({ itemCategory: 'AI', activeCategory: 'Sports', strength: 0.5 })).toBeCloseTo(0.5)
  })

  it('never dims a non-matching item below the 0.15 floor', () => {
    expect(pullFactor({ itemCategory: 'AI', activeCategory: 'Sports', strength: 1 })).toBe(0.15)
  })
})

describe('decayStrength', () => {
  it('decays toward zero as dt grows', () => {
    const soon = decayStrength(1, 0.1)
    const later = decayStrength(1, 5)
    expect(soon).toBeGreaterThan(later)
    expect(later).toBeGreaterThanOrEqual(0)
  })

  it('is unchanged at dt=0', () => {
    expect(decayStrength(0.7, 0)).toBeCloseTo(0.7)
  })
})
