import { describe, it, expect } from 'vitest'
import { INITIAL_CAMERA_STATE, cameraReducer } from './cameraMachine.js'

describe('cameraReducer', () => {
  it('starts idle, in the news region, no target', () => {
    expect(INITIAL_CAMERA_STATE).toEqual({ mode: 'idle', targetId: null, region: 'news' })
  })

  it('FOCUS moves idle -> focused with the given target', () => {
    const next = cameraReducer(INITIAL_CAMERA_STATE, { type: 'FOCUS', id: 'star-3' })
    expect(next).toEqual({ mode: 'focused', targetId: 'star-3', region: 'news' })
  })

  it('OPEN_READER moves focused -> reader-open, keeping the target', () => {
    const focused = { mode: 'focused', targetId: 'star-3', region: 'news' }
    const next = cameraReducer(focused, { type: 'OPEN_READER' })
    expect(next).toEqual({ mode: 'reader-open', targetId: 'star-3', region: 'news' })
  })

  it('OPEN_READER from idle is a no-op (never crashes on a stray action)', () => {
    const next = cameraReducer(INITIAL_CAMERA_STATE, { type: 'OPEN_READER' })
    expect(next).toBe(INITIAL_CAMERA_STATE)
  })

  it('CLOSE_READER returns to idle and clears the target from any mode', () => {
    const readerOpen = { mode: 'reader-open', targetId: 'star-3', region: 'news' }
    const next = cameraReducer(readerOpen, { type: 'CLOSE_READER' })
    expect(next).toEqual({ mode: 'idle', targetId: null, region: 'news' })
  })

  it('BLUR from focused returns to idle and clears the target', () => {
    const focused = { mode: 'focused', targetId: 'star-3', region: 'news' }
    const next = cameraReducer(focused, { type: 'BLUR' })
    expect(next).toEqual({ mode: 'idle', targetId: null, region: 'news' })
  })

  it('SWITCH_REGION enters region-transition and sets the new region', () => {
    const next = cameraReducer(INITIAL_CAMERA_STATE, { type: 'SWITCH_REGION', region: 'markets' })
    expect(next).toEqual({ mode: 'region-transition', targetId: null, region: 'markets' })
  })

  it('REGION_ARRIVED settles a transition back to idle, keeping the region', () => {
    const transitioning = { mode: 'region-transition', targetId: null, region: 'markets' }
    const next = cameraReducer(transitioning, { type: 'REGION_ARRIVED' })
    expect(next).toEqual({ mode: 'idle', targetId: null, region: 'markets' })
  })
})
