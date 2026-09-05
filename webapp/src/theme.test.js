import { describe, it, expect } from 'vitest'
import { PALETTE, CATEGORY_COLOR, colorForCategory, sizeForArticle } from './theme.js'

describe('PALETTE', () => {
  it('has no trace of the old green theme', () => {
    const values = Object.values(PALETTE)
    expect(values).not.toContain('#3FD98B')
    expect(values).not.toContain('#0B100E')
  })

  it('defines the exact Violet Night tokens', () => {
    expect(PALETTE.bg0).toBe('#0C0914')
    expect(PALETTE.bg1).toBe('#15111F')
    expect(PALETTE.bg2).toBe('#2A2140')
    expect(PALETTE.violet).toBe('#B084FF')
    expect(PALETTE.pink).toBe('#FF6FB3')
    expect(PALETTE.mint).toBe('#00E6C3')
    expect(PALETTE.amber).toBe('#FFD166')
    expect(PALETTE.coral).toBe('#FF8A65')
  })
})

describe('colorForCategory', () => {
  it('returns a mapped color for a known category', () => {
    expect(colorForCategory('Sports')).toBe(CATEGORY_COLOR.Sports)
  })

  it('falls back to violet for an unknown category', () => {
    expect(colorForCategory('Nonexistent')).toBe(PALETTE.violet)
  })

  it('maps every CATEGORY_ORDER entry to a real palette color', () => {
    const paletteValues = new Set(Object.values(PALETTE))
    for (const cat of Object.keys(CATEGORY_COLOR)) {
      expect(paletteValues.has(CATEGORY_COLOR[cat])).toBe(true)
    }
  })
})

describe('sizeForArticle', () => {
  it('sizes a high-importance article larger', () => {
    expect(sizeForArticle({ importance: 'high' })).toBe(1.6)
  })
  it('sizes a top_story article larger', () => {
    expect(sizeForArticle({ top_story: true })).toBe(1.6)
  })
  it('sizes an ordinary article at baseline', () => {
    expect(sizeForArticle({ importance: 'medium', top_story: false })).toBe(1.0)
  })
})
