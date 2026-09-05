# newss Constellation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark-green, tab-based `webapp/` React app with the "Violet Night" / "Playful Reactive" / "Constellation" redesign: a pannable 3D starfield home (articles as stars, briefs/wire as dust), gravity-drag category filtering, a three-region camera space (News sky / Markets belt / Glossary nebula) replacing the bottom tab bar, and a mobile scroll-list fallback — all driven by the existing `articles.json`/`markets.json` data, unchanged.

**Architecture:** `@react-three/fiber` renders one `<Canvas>` whose camera is driven by a small explicit state machine (`idle` → `focused` → `reader-open` → `region-transition`). Stars are individual meshes (≤15, one per deep article); briefs/wire render as two `InstancedMesh`/`Points` "dust" layers, never as individual meshes. A device-capability check picks one of three render tiers (full 3D / reduced 3D / mobile list) once on mount. 2D chrome (reader panel, category dock, region switcher, onboarding hint) is plain React + Framer Motion layered over the canvas via CSS, not inside the WebGL scene.

**Tech Stack:** React 19, Vite, `@react-three/fiber` (existing), `@react-three/drei` (existing), `three` (existing) — adding `@react-three/postprocessing` (bloom/glow), `framer-motion` (2D chrome transitions), `vitest` + `@testing-library/react` + `jsdom` (no test runner exists in `webapp/` yet; required for TDD on the pure-logic modules this plan adds).

**Spec:** `docs/superpowers/specs/2026-09-05-newss-constellation-redesign-design.md`

## Global Constraints

- Palette tokens are exactly the values in spec §3 (`--bg-0:#0C0914`, `--bg-1:#15111F`, `--bg-2:#2A2140`, `--line:#3A2E55`, `--ink:#F1ECFF`, `--muted:#9C8FC4`, `--faint:#6B5F8F`, `--violet:#B084FF`, `--pink:#FF6FB3`, `--mint:#00E6C3`, `--amber:#FFD166`, `--coral:#FF8A65`). No `--accent:#3FD98B` / `--bg:#0B100E` (old green theme) may appear anywhere in new code.
- Dust (briefs, wire) is rendered as instanced/points geometry, never one mesh per item (spec §4.2 — load-bearing perf decision, not negotiable during implementation).
- `prefers-reduced-motion` disables drift/bulge/parallax/eased-fly and forces instant/snap transitions everywhere motion is added (spec §3, §4.1).
- Viewports <760px use the mobile scroll-list fallback (spec §4.5), not the drag-physics canvas.
- `app/articles.json`, `app/markets.json`, `server/`, `scripts/`, `routine.md` are out of scope — no changes.
- `vite.config.js`'s `base:'./'` and `outDir:'../app'` / `emptyOutDir:false` contract stays as-is (existing file, do not change).
- New dependencies limited to exactly: `@react-three/postprocessing`, `framer-motion`, `vitest`, `@testing-library/react`, `jsdom`, `@testing-library/jest-dom`. Nothing else.

---

## File Structure

```
webapp/
  vitest.config.js                       [create] — vitest + jsdom setup, separate from vite.config.js's build settings
  src/
    theme.js                             [create] — palette tokens, CATEGORY_COLOR map, size-for-importance()
    device.js                            [create] — pickRenderTier(): 'full' | 'reduced' | 'mobile'
    camera/
      cameraMachine.js                   [create] — pure state-machine reducer (no R3F/Three imports — testable in jsdom)
      CameraRig.jsx                      [create] — R3F component wiring cameraMachine to an actual PerspectiveCamera
    gravity/
      gravityPull.js                     [create] — pure physics calc: given active category + positions, returns per-item pull vector
      useGravityDrag.js                  [create] — desktop drag-to-filter hook, wraps gravityPull.js with pointer events
    three/
      Star.jsx                           [create] — one article's star mesh: color, size, hover glow
      Dust.jsx                           [create] — instanced points layer for one tier (briefs or wire)
      Starfield.jsx                      [create] — orchestrates Star[]/Dust/CameraRig for the News sky region
    components/
      CategoryDock.jsx                   [create] — draggable category blobs (desktop) / tap chips (mobile), uses gravityPull.js
      RegionSwitcher.jsx                 [create] — minimap (desktop) / pill toggle (mobile) for News/Markets/Glossary
      ReaderPanel.jsx                    [create] — restyled article reader with morph-in transition (Framer Motion); replaces components/Reader.jsx
      MarketsBelt.jsx                    [create] — restyled Markets.jsx content, Violet Night palette, belt framing
      GlossaryNebula.jsx                 [create] — restyled Glossary.jsx content, Violet Night palette, nebula framing
      MobileList.jsx                     [create] — <760px fallback: vertical scroll list of the same stars/briefs/wire
      OnboardingHint.jsx                 [create] — one-time overlay explaining gravity-drag + dust zoom, localStorage-gated
    App.jsx                              [modify — full rewrite] — device-tier selection, region state, mounts Starfield+chrome or MobileList
    styles.css                           [modify — full rewrite] — Violet Night tokens + new component classes; delete old green tokens
    Hero3D.jsx                           [delete] — superseded by three/Star.jsx + Starfield.jsx
    components/Cards.jsx                 [delete] — superseded by three/Star.jsx (stars) + MobileList.jsx (mobile cards)
    components/Home.jsx                  [delete] — superseded by three/Starfield.jsx
    components/Reader.jsx                [delete] — superseded by components/ReaderPanel.jsx
    components/Markets.jsx               [delete] — superseded by components/MarketsBelt.jsx
    components/Glossary.jsx              [delete] — superseded by components/GlossaryNebula.jsx
    lib.js                               [keep, unmodified] — ago(), tierTag(), hl(), bodyHtml(), escapeHtml(), CATEGORY_ORDER all still used as-is by ReaderPanel/MobileList
```

---

### Task 1: Test runner setup (vitest)

**Files:**
- Modify: `webapp/package.json`
- Create: `webapp/vitest.config.js`
- Create: `webapp/src/setupTests.js`
- Create: `webapp/src/theme.test.js` (placeholder smoke test to prove the runner works; superseded by Task 2's real tests)

**Interfaces:**
- Produces: `npm run test` (single run), `npm run test:watch` — used by every subsequent task's test steps.

- [ ] **Step 1: Install test dependencies**

```bash
cd webapp
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create `webapp/vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
  },
})
```

- [ ] **Step 3: Create `webapp/src/setupTests.js`**

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Add test scripts to `webapp/package.json`**

Add under `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test — `webapp/src/theme.test.js`**

```js
import { describe, it, expect } from 'vitest'

describe('test runner smoke check', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run it, confirm the runner works**

Run: `cd webapp && npm test`
Expected: 1 test file, 1 test, PASS.

- [ ] **Step 7: Commit**

```bash
git add webapp/package.json webapp/package-lock.json webapp/vitest.config.js webapp/src/setupTests.js webapp/src/theme.test.js
git commit -m "test: add vitest + testing-library to webapp"
```

---

### Task 2: Theme tokens + category color mapping

**Files:**
- Create: `webapp/src/theme.js`
- Test: `webapp/src/theme.test.js` (replace Task 1's placeholder content)

**Interfaces:**
- Produces:
  - `PALETTE` — object with the exact keys/values from Global Constraints.
  - `CATEGORY_COLOR: Record<string, string>` — maps every category in `lib.js`'s `CATEGORY_ORDER` to one of `PALETTE`'s accent colors.
  - `colorForCategory(category: string): string` — returns `CATEGORY_COLOR[category]`, falling back to `PALETTE.violet` for an unknown category.
  - `sizeForArticle(article: { importance?: string, top_story?: boolean }): number` — returns `1.6` if `importance === 'high'` or `top_story === true`, else `1.0`.

- [ ] **Step 1: Write the failing tests — replace `webapp/src/theme.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `theme.js` does not exist yet.

- [ ] **Step 3: Create `webapp/src/theme.js`**

```js
// Violet Night palette — see docs/superpowers/specs/2026-09-05-newss-constellation-redesign-design.md §3.
// Deliberately shares zero colors with the old green/near-black theme.
export const PALETTE = {
  bg0: '#0C0914',
  bg1: '#15111F',
  bg2: '#2A2140',
  line: '#3A2E55',
  ink: '#F1ECFF',
  muted: '#9C8FC4',
  faint: '#6B5F8F',
  violet: '#B084FF',
  pink: '#FF6FB3',
  mint: '#00E6C3',
  amber: '#FFD166',
  coral: '#FF8A65',
  glowViolet: 'rgba(176,132,255,.45)',
  glowPink: 'rgba(255,111,179,.45)',
}

// Fixed table, not inferred — per spec §3 ("fixed table in code, not inferred").
// Same category set as webapp/src/lib.js's CATEGORY_ORDER.
export const CATEGORY_COLOR = {
  Markets: PALETTE.violet,
  'Economy & Policy': PALETTE.violet,
  Business: PALETTE.amber,
  Startups: PALETTE.amber,
  AI: PALETTE.amber,
  Innovation: PALETTE.amber,
  Geopolitics: PALETTE.coral,
  India: PALETTE.pink,
  Aviation: PALETTE.coral,
  World: PALETTE.coral,
  Analysis: PALETTE.violet,
  Sports: PALETTE.mint,
  Entertainment: PALETTE.pink,
  Science: PALETTE.mint,
  Education: PALETTE.mint,
  Government: PALETTE.violet,
  Exam: PALETTE.mint,
}

export function colorForCategory(category) {
  return CATEGORY_COLOR[category] || PALETTE.violet
}

export function sizeForArticle(article) {
  return article.importance === 'high' || article.top_story === true ? 1.6 : 1.0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/theme.js webapp/src/theme.test.js
git commit -m "feat: add Violet Night palette and category color mapping"
```

---

### Task 3: Device render-tier selection

**Files:**
- Create: `webapp/src/device.js`
- Test: `webapp/src/device.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `pickRenderTier(env: { width: number, reducedMotion: boolean, hardwareConcurrency: number }): 'full' | 'reduced' | 'mobile'` — a pure function taking an explicit env object (not reading `window`/`navigator` itself) so it's testable without DOM mocking. `useRenderTier(): 'full'|'reduced'|'mobile'` — a hook that reads real `window`/`navigator`/`matchMedia` once on mount and calls `pickRenderTier`.

- [ ] **Step 1: Write the failing tests — `webapp/src/device.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `device.js` does not exist.

- [ ] **Step 3: Create `webapp/src/device.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/device.js webapp/src/device.test.js
git commit -m "feat: add device render-tier selection (full/reduced/mobile)"
```

---

### Task 4: Camera state machine (pure logic)

**Files:**
- Create: `webapp/src/camera/cameraMachine.js`
- Test: `webapp/src/camera/cameraMachine.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `INITIAL_CAMERA_STATE = { mode: 'idle', targetId: null, region: 'news' }`
  - `cameraReducer(state, action)` where `action` is one of:
    - `{ type: 'FOCUS', id: string }` → `mode:'focused', targetId:id`
    - `{ type: 'OPEN_READER' }` (only valid from `focused`) → `mode:'reader-open'`
    - `{ type: 'CLOSE_READER' }` → `mode:'idle', targetId:null`
    - `{ type: 'BLUR' }` (from `focused`, not `reader-open`) → `mode:'idle', targetId:null`
    - `{ type: 'SWITCH_REGION', region: 'news'|'markets'|'glossary' }` → `mode:'region-transition'` then caller dispatches a follow-up `REGION_ARRIVED` — modeled as two actions so a component can render a transition state and then settle.
    - `{ type: 'REGION_ARRIVED' }` → `mode:'idle'`, `region` unchanged (already set by `SWITCH_REGION`)
  - Invalid transitions (e.g. `OPEN_READER` while `mode==='idle'`) return `state` unchanged (no-op), never throw — a camera rig calling this from render must never crash on a stray action.

- [ ] **Step 1: Write the failing tests — `webapp/src/camera/cameraMachine.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `cameraMachine.js` does not exist.

- [ ] **Step 3: Create `webapp/src/camera/cameraMachine.js`**

```js
// Pure state machine for the constellation camera — no R3F/Three imports,
// so it's testable in plain jsdom. See spec §5 "small state machine".
export const INITIAL_CAMERA_STATE = { mode: 'idle', targetId: null, region: 'news' }

export function cameraReducer(state, action) {
  switch (action.type) {
    case 'FOCUS':
      if (state.mode !== 'idle') return state
      return { ...state, mode: 'focused', targetId: action.id }

    case 'OPEN_READER':
      if (state.mode !== 'focused') return state
      return { ...state, mode: 'reader-open' }

    case 'CLOSE_READER':
      if (state.mode !== 'reader-open' && state.mode !== 'focused') return state
      return { ...state, mode: 'idle', targetId: null }

    case 'BLUR':
      if (state.mode !== 'focused') return state
      return { ...state, mode: 'idle', targetId: null }

    case 'SWITCH_REGION':
      return { mode: 'region-transition', targetId: null, region: action.region }

    case 'REGION_ARRIVED':
      if (state.mode !== 'region-transition') return state
      return { ...state, mode: 'idle' }

    default:
      return state
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/camera/cameraMachine.js webapp/src/camera/cameraMachine.test.js
git commit -m "feat: add pure camera state machine for constellation navigation"
```

---

### Task 5: Gravity-pull physics (pure logic)

**Files:**
- Create: `webapp/src/gravity/gravityPull.js`
- Test: `webapp/src/gravity/gravityPull.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (category strings are plain strings).
- Produces: `pullFactor({ itemCategory: string, activeCategory: string|null, strength: number }): number` — returns a 0..1 multiplier: `1` when `activeCategory` is `null` (no filter active, nothing pulled or dimmed), `1` when `itemCategory === activeCategory` scaled up by `strength`... concretely:
  - `activeCategory === null` → returns `1` (neutral, spec's "released ... decays back to neutral")
  - `itemCategory === activeCategory` → returns `1 + strength` (brighten/pull closer)
  - otherwise → returns `Math.max(0.15, 1 - strength)` (dim/drift outward, floor at 0.15 so items never fully disappear)
  - `decayStrength(strength: number, dt: number): number` — exponential decay toward 0, `strength * Math.exp(-dt / DECAY_TAU)`, used each frame after the user releases a dragged category blob (spec §4.3 "decay back to neutral over a few seconds").

- [ ] **Step 1: Write the failing tests — `webapp/src/gravity/gravityPull.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `gravityPull.js` does not exist.

- [ ] **Step 3: Create `webapp/src/gravity/gravityPull.js`**

```js
// Pure physics helpers for the "gravity drag" category filter — spec §4.3.
// Kept free of DOM/Three imports so the tuning constants below can be
// unit-tested directly.
const DECAY_TAU = 1.6 // seconds; ~63% decayed after this long post-release
const DIM_FLOOR = 0.15 // items never fully vanish when filtered out

export function pullFactor({ itemCategory, activeCategory, strength }) {
  if (activeCategory == null) return 1
  if (itemCategory === activeCategory) return 1 + strength
  return Math.max(DIM_FLOOR, 1 - strength)
}

export function decayStrength(strength, dt) {
  return strength * Math.exp(-dt / DECAY_TAU)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/gravity/gravityPull.js webapp/src/gravity/gravityPull.test.js
git commit -m "feat: add gravity-drag pull/decay physics for category filtering"
```

---

### Task 6: Onboarding hint (localStorage-gated)

**Files:**
- Create: `webapp/src/components/OnboardingHint.jsx`
- Test: `webapp/src/components/OnboardingHint.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<OnboardingHint />` — renders a dismissible overlay explaining gravity-drag and dust-zoom (spec §7 risk) the first time it mounts; renders nothing on subsequent mounts once `localStorage['mynews-onboarded']` is set. Exposes no props — self-contained per spec's "explicit onboarding treatment" note.

- [ ] **Step 1: Write the failing tests — `webapp/src/components/OnboardingHint.test.jsx`**

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingHint from './OnboardingHint.jsx'

describe('OnboardingHint', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the hint on first visit', () => {
    render(<OnboardingHint />)
    expect(screen.getByText(/drag a category/i)).toBeInTheDocument()
  })

  it('dismisses and persists the flag when the user closes it', () => {
    render(<OnboardingHint />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByText(/drag a category/i)).not.toBeInTheDocument()
    expect(localStorage.getItem('mynews-onboarded')).toBe('1')
  })

  it('does not show on a later mount once onboarded', () => {
    localStorage.setItem('mynews-onboarded', '1')
    render(<OnboardingHint />)
    expect(screen.queryByText(/drag a category/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `OnboardingHint.jsx` does not exist.

- [ ] **Step 3: Create `webapp/src/components/OnboardingHint.jsx`**

```jsx
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/OnboardingHint.jsx webapp/src/components/OnboardingHint.test.jsx
git commit -m "feat: add one-time onboarding hint for gravity-drag and dust zoom"
```

---

### Task 7: Violet Night stylesheet

**Files:**
- Modify: `webapp/src/styles.css` (full rewrite)

**Interfaces:**
- Consumes: `PALETTE` values from Task 2 (copied as literal CSS custom properties — CSS can't import JS, so the constants module and this file must be kept in sync; a comment cross-references both files so future edits update them together).
- Produces: CSS custom properties and classes consumed by every component task from here on: `.constellation-canvas`, `.category-dock`, `.category-blob`, `.region-switcher`, `.reader-panel`, `.mobile-list`, `.mobile-card`, `.onboarding-hint`. Also keeps the article-reader content classes from the old stylesheet that Task 10 (ReaderPanel) still needs verbatim: `.simple`, `.nums`, `.num`, `.gloss`, `.gitem`, `details.full`, `.body`, `mark`, `.verify`, `.srcbtn`, `.examrail`, `.efact`, `.ekind`, `.etext`, `.eas`, `.edrill`.

- [ ] **Step 1: Replace `webapp/src/styles.css` in full**

```css
/* Violet Night palette — kept in sync with webapp/src/theme.js's PALETTE.
   If you change a value here, change it there too (and vice versa). */
:root {
  --bg-0:#0C0914; --bg-1:#15111F; --bg-2:#2A2140;
  --line:#3A2E55; --ink:#F1ECFF; --muted:#9C8FC4; --faint:#6B5F8F;
  --violet:#B084FF; --pink:#FF6FB3; --mint:#00E6C3; --amber:#FFD166; --coral:#FF8A65;
  --glow-violet:rgba(176,132,255,.45); --glow-pink:rgba(255,111,179,.45);
  --serif:'Newsreader', Georgia, serif;
  --sans:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --ease:cubic-bezier(.22,.61,.36,1);
}

* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html,body,#root { margin:0; padding:0; height:100%; }
body {
  background:radial-gradient(ellipse at top, var(--bg-1), var(--bg-0));
  color:var(--ink); font-family:var(--sans); font-size:16px; line-height:1.6;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
button { font-family:inherit; border:none; background:none; color:inherit; cursor:pointer; }
a { color:inherit; }
img { display:block; max-width:100%; }
:focus-visible { outline:2px solid var(--violet); outline-offset:3px; border-radius:6px; }

/* ---------- constellation canvas + chrome overlay ---------- */
.constellation-canvas { position:fixed; inset:0; z-index:0; }
.chrome { position:relative; z-index:10; pointer-events:none; }
.chrome > * { pointer-events:auto; }

/* ---------- category dock (gravity-drag blobs / mobile tap chips) ---------- */
.category-dock { position:fixed; left:0; right:0; bottom:0; z-index:20;
                  display:flex; gap:10px; padding:16px; overflow-x:auto; }
.category-blob {
  flex:none; padding:10px 18px; border-radius:999px; font-size:13px; font-weight:600;
  background:var(--bg-2); border:1px solid var(--line); color:var(--muted);
  transition:background .18s var(--ease), color .18s var(--ease), transform .18s var(--ease);
  cursor:grab;
}
.category-blob.active { color:var(--bg-0); font-weight:800; }
.category-blob:active { cursor:grabbing; }

/* ---------- region switcher (minimap desktop / pill mobile) ---------- */
.region-switcher {
  position:fixed; top:16px; right:16px; z-index:20; display:flex; gap:6px;
  background:var(--bg-2); border:1px solid var(--line); border-radius:999px; padding:6px;
}
.region-switcher button { padding:8px 16px; border-radius:999px; font-size:12.5px; font-weight:600; color:var(--muted); }
.region-switcher button.on { background:var(--violet); color:var(--bg-0); }

/* ---------- reader panel ---------- */
.reader-panel {
  position:fixed; inset:0; z-index:80; background:var(--bg-0); overflow-y:auto;
  -webkit-overflow-scrolling:touch;
}
.reader-panel .rbar { position:sticky; top:0; z-index:5; background:var(--bg-0); padding:12px 18px; }
.reader-panel .back { font-size:15px; color:var(--muted); display:inline-flex; gap:8px; align-items:center; }
.reader-panel .art { max-width:720px; margin:0 auto; padding:0 18px 60px; }
.reader-panel .lead { width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:18px; background:var(--bg-2); }
.reader-panel h1 {
  font-family:var(--serif); font-size:clamp(27px,7vw,36px); line-height:1.15; font-weight:600;
  letter-spacing:-.02em; margin:18px 0 12px;
}
.reader-panel .byline { font-size:12.5px; color:var(--faint); padding-bottom:18px; }
.reader-panel .cat { font-size:10.5px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; }

@media (min-width:1180px) {
  .reader-panel .art { max-width:none; display:grid; grid-template-columns:720px minmax(280px,1fr);
                        gap:40px; padding:0 40px 60px; align-items:start; }
  .reader-panel .art > * { grid-column:1; max-width:720px; }
  .reader-panel .art > .lead { max-width:none; max-height:420px; }
  .reader-panel .art > .examrail { grid-column:2; grid-row:1 / span 99; align-self:start; max-width:none; position:sticky; top:72px; }
  .reader-panel .art.norail { grid-template-columns:minmax(0,720px); justify-content:center; }
}

/* article body content — unchanged structure/classes from the previous
   theme, restyled to Violet Night tokens only (Task 10 reuses these as-is) */
.simple { background:rgba(176,132,255,.12); border:1px solid var(--violet); border-radius:18px; padding:18px; margin-bottom:20px; }
.simple h3 { margin:0 0 12px; font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--violet); }
.simple ul { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:11px; }
.simple li { font-size:16px; line-height:1.55; padding-left:22px; position:relative; }
.simple li::before { content:""; position:absolute; left:0; top:9px; width:7px; height:7px; border-radius:50%; background:var(--violet); }
.nums { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:20px; }
.num { background:var(--bg-2); border:1px solid var(--line); border-radius:14px; padding:13px 14px; }
.num .v { font-size:19px; font-weight:700; color:var(--violet); }
.num .l { font-size:11.5px; line-height:1.4; color:var(--muted); margin-top:4px; }
.gloss { margin-bottom:22px; }
.gloss h3 { margin:0 0 10px; font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); }
.gitem { background:var(--bg-2); border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin-bottom:8px; }
.gitem b { color:var(--violet); font-size:14px; }
.gitem span { display:block; font-size:13.5px; line-height:1.5; color:var(--muted); margin-top:3px; }
details.full { margin-bottom:22px; }
details.full > summary { list-style:none; cursor:pointer; padding:14px 16px; border-radius:14px; background:var(--bg-2);
                          border:1px solid var(--line); font-size:14px; font-weight:600; display:flex; gap:9px; }
details.full > summary::-webkit-details-marker { display:none; }
details.full > summary::after { content:"▾"; margin-left:auto; color:var(--faint); }
details.full[open] > summary::after { content:"▴"; }
.body { padding:18px 2px 0; }
.body p { font-size:17px; line-height:1.75; margin:0 0 20px; }
.body h2 { font-family:var(--serif); font-size:21px; font-weight:600; margin:30px 0 12px; }
.body ul { padding-left:20px; margin:0 0 20px; }
.body li { font-size:16.5px; line-height:1.7; margin-bottom:7px; }
.body b { font-weight:600; }
mark { background:rgba(176,132,255,.18); color:var(--violet); font-weight:700; padding:1px 5px; border-radius:5px; }
.verify { background:var(--bg-2); border:1px solid var(--line); border-radius:14px; padding:15px 16px; margin-bottom:18px; }
.verify h3 { margin:0 0 9px; font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); font-weight:800; }
.verify a { display:block; color:var(--violet); text-decoration:none; font-size:14px; padding:4px 0; }
.srcbtn { display:block; text-align:center; margin-top:8px; padding:15px; border-radius:14px; background:var(--violet);
          color:var(--bg-0); font-weight:700; font-size:15px; text-decoration:none; }
.note { margin-top:20px; font-size:12px; line-height:1.6; color:var(--faint); }
.examrail { background:var(--bg-2); border:1px solid var(--violet); border-radius:18px; padding:16px 16px 18px; margin:22px 0; }
.examrail h3 { margin:0 0 12px; font-size:11.5px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--violet); }
.efact { padding:9px 0; border-bottom:1px solid var(--line); }
.efact:last-of-type { border-bottom:none; }
.ekind { font-size:9.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--faint); }
.etext { font-size:13.5px; line-height:1.45; margin-top:3px; }
.eas { font-size:10.5px; color:var(--faint); margin-top:4px; }
.edrill { margin-top:12px; border-top:1px solid var(--line); padding-top:12px; }
.edrill summary { font-size:12.5px; font-weight:700; color:var(--violet); cursor:pointer; }
.edrill ol { margin:8px 0 0; padding-left:20px; font-size:13px; line-height:1.6; }
.eans { font-size:12px; color:var(--faint); margin:8px 0 0; }

/* ---------- mobile fallback list (<760px) ---------- */
.mobile-list { padding:16px; padding-bottom:100px; }
.mobile-card {
  display:flex; gap:12px; align-items:center; width:100%; text-align:left;
  background:var(--bg-2); border:1px solid var(--line); border-radius:16px; padding:14px; margin-bottom:12px;
}
.mobile-card .dot { width:14px; height:14px; border-radius:50%; flex:none; }
.mobile-card h4 { font-family:var(--serif); font-size:16px; font-weight:600; margin:0 0 4px; }
.mobile-card p { margin:0; font-size:12.5px; color:var(--faint); }
.mobile-chip-row { display:flex; gap:8px; overflow-x:auto; padding:12px 16px; }
.mobile-chip { flex:none; padding:8px 14px; border-radius:999px; font-size:12.5px; font-weight:600;
               background:var(--bg-2); border:1px solid var(--line); color:var(--muted); }
.mobile-chip.on { background:var(--violet); color:var(--bg-0); }

/* ---------- onboarding hint ---------- */
.onboarding-hint {
  position:fixed; inset:0; z-index:100; background:rgba(12,9,20,.88);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
  padding:24px; text-align:center;
}
.onboarding-hint p { max-width:360px; font-size:15px; line-height:1.5; color:var(--ink); }
.onboarding-hint button { background:var(--violet); color:var(--bg-0); font-weight:700; padding:12px 26px; border-radius:999px; }

@media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; transition-duration:.001ms !important; } }
```

- [ ] **Step 2: Verify no old-theme colors remain**

Run: `cd webapp && grep -n "3FD98B\|0B100E" src/styles.css`
Expected: no output (grep finds nothing).

- [ ] **Step 3: Commit**

```bash
git add webapp/src/styles.css
git commit -m "feat: replace stylesheet with Violet Night palette and constellation chrome classes"
```

---

### Task 8: Star and Dust R3F components

**Files:**
- Create: `webapp/src/three/Star.jsx`
- Create: `webapp/src/three/Dust.jsx`

**Interfaces:**
- Consumes: `colorForCategory`, `sizeForArticle` from `theme.js` (Task 2).
- Produces:
  - `<Star article={article} position={[x,y,z]} pull={number} onFocus={(id)=>void} />` — one mesh, `article.category` colors it via `colorForCategory`, `sizeForArticle(article)` scales it, `pull` (from Task 5's `pullFactor`) further scales/brightens it, pointer-over triggers a hover glow (via emissive intensity), click calls `onFocus(article.url)`.
  - `<Dust items={Array<{position:[x,y,z]}>} color={string} opacity={number} />` — renders `items.length` points as a single `Points`/`InstancedMesh` (never one mesh per item — Global Constraint), colored uniformly by `color`, at the given `opacity`.
- Manual verification only for these two (R3F canvas rendering isn't meaningfully unit-testable in jsdom) — verification happens in Task 9's browser check, where both are exercised together.

- [ ] **Step 1: Create `webapp/src/three/Star.jsx`**

```jsx
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { colorForCategory, sizeForArticle } from '../theme.js'

// One deep article rendered as a star mesh. Never used for briefs/wire —
// those go through Dust.jsx as instanced geometry (Global Constraint).
export default function Star({ article, position, pull = 1, onFocus }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const baseScale = sizeForArticle(article) * pull
  const color = colorForCategory(article.category)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.getElapsedTime()
    // gentle idle drift, per spec §3 motion principles
    ref.current.position.y = position[1] + Math.sin(t * 0.4 + position[0]) * 0.08
    const targetScale = hovered ? baseScale * 1.25 : baseScale
    ref.current.scale.lerp({ x: targetScale, y: targetScale, z: targetScale }, 0.15)
  })

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => onFocus(article.url)}
    >
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.9 : 0.4}
        roughness={0.3}
      />
    </mesh>
  )
}
```

- [ ] **Step 2: Create `webapp/src/three/Dust.jsx`**

```jsx
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Renders an entire tier (briefs or wire) as ONE Points object — this is
// the load-bearing perf decision from spec §4.2: never one mesh per item.
export default function Dust({ items, color, opacity = 0.35 }) {
  const ref = useRef()

  const positions = useMemo(() => {
    const arr = new Float32Array(items.length * 3)
    items.forEach((item, i) => {
      arr[i * 3] = item.position[0]
      arr[i * 3 + 1] = item.position[1]
      arr[i * 3 + 2] = item.position[2]
    })
    return arr
  }, [items])

  useFrame((state) => {
    if (!ref.current) return
    // slow drift, dimmer/slower than stars per spec §3
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.01
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} transparent opacity={opacity} sizeAttenuation />
    </points>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/three/Star.jsx webapp/src/three/Dust.jsx
git commit -m "feat: add Star (per-article mesh) and Dust (instanced tier) R3F components"
```

---

### Task 9: CameraRig + Starfield orchestrator

**Files:**
- Create: `webapp/src/camera/CameraRig.jsx`
- Create: `webapp/src/three/Starfield.jsx`

**Interfaces:**
- Consumes: `cameraReducer`, `INITIAL_CAMERA_STATE` (Task 4); `Star`, `Dust` (Task 8); `pullFactor` (Task 5).
- Produces: `<Starfield articles={Article[]} briefs={Brief[]} wire={WireItem[]} activeCategory={string|null} pullStrength={number} onOpenArticle={(url)=>void} />` — lays out `articles` deterministically on a sphere shell (golden-angle spiral, same seed every render so positions don't jump on re-render), passes each a `pull` value from `pullFactor`, renders two `Dust` layers (briefs dimmer than wire... actually wire is the dimmest per spec §4.2 — wire dimmest, briefs brighter), and owns the `<Canvas>` + `CameraRig`.
- `<CameraRig state={CameraState} />` — R3F component that reads `x,y,z` off `useThree().camera` and eases it based on `state.mode`/`state.targetId`; internal only, not used outside `Starfield.jsx`.

- [ ] **Step 1: Create `webapp/src/camera/CameraRig.jsx`**

```jsx
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Drives the Canvas camera off the pure cameraMachine state (Task 4).
// idle: stays at the default position. focused: dollies toward targetPosition.
// reader-open: holds still (spec §4.4 — "no 3D behind an open reader").
const DEFAULT_POSITION = new THREE.Vector3(0, 0, 8)

export default function CameraRig({ state, targetPosition, reducedMotion }) {
  const { camera } = useThree()
  const desired = useRef(DEFAULT_POSITION.clone())

  useFrame(() => {
    if (state.mode === 'focused' && targetPosition) {
      desired.current.set(targetPosition[0], targetPosition[1], targetPosition[2] + 2)
    } else if (state.mode === 'idle') {
      desired.current.copy(DEFAULT_POSITION)
    }
    // reader-open: leave desired wherever it was — camera holds still.
    if (reducedMotion) {
      camera.position.copy(desired.current)
    } else {
      camera.position.lerp(desired.current, 0.06)
    }
    camera.lookAt(0, 0, 0)
  })

  return null
}
```

- [ ] **Step 2: Create `webapp/src/three/Starfield.jsx`**

```jsx
import { useMemo, useReducer } from 'react'
import { Canvas } from '@react-three/fiber'
import Star from './Star.jsx'
import Dust from './Dust.jsx'
import CameraRig from '../camera/CameraRig.jsx'
import { cameraReducer, INITIAL_CAMERA_STATE } from '../camera/cameraMachine.js'
import { pullFactor } from '../gravity/gravityPull.js'
import { colorForCategory, PALETTE } from '../theme.js'

// Deterministic golden-angle spiral so star positions are stable across
// re-renders (no data-driven randomness — same articles always land in
// the same spots for a given index).
function sphereLayout(index, total, radius = 4.5) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (index / Math.max(1, total - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = golden * index
  return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]
}

export default function Starfield({ articles, briefs, wire, activeCategory, pullStrength, onOpenArticle, reducedMotion }) {
  const [camState, dispatch] = useReducer(cameraReducer, INITIAL_CAMERA_STATE)

  const starPositions = useMemo(
    () => articles.map((_, i) => sphereLayout(i, articles.length)),
    [articles]
  )

  const briefDust = useMemo(
    () => briefs.map((_, i) => ({ position: sphereLayout(i, briefs.length, 6) })),
    [briefs]
  )
  const wireDust = useMemo(
    () => wire.map((_, i) => ({ position: sphereLayout(i, wire.length, 8) })),
    [wire]
  )

  const focusedIndex = articles.findIndex((a) => a.url === camState.targetId)
  const targetPosition = focusedIndex >= 0 ? starPositions[focusedIndex] : null

  function handleFocus(url) {
    dispatch({ type: 'FOCUS', id: url })
    onOpenArticle(url)
  }

  return (
    <Canvas className="constellation-canvas" camera={{ position: [0, 0, 8], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color={PALETTE.violet} />
      <CameraRig state={camState} targetPosition={targetPosition} reducedMotion={reducedMotion} />
      {/* wire is the dimmest tier, briefs brighter — spec §4.2 tiering */}
      <Dust items={wireDust} color={PALETTE.faint} opacity={0.15} />
      <Dust items={briefDust} color={PALETTE.muted} opacity={0.3} />
      {articles.map((article, i) => (
        <Star
          key={article.url}
          article={article}
          position={starPositions[i]}
          pull={pullFactor({ itemCategory: article.category, activeCategory, strength: pullStrength })}
          onFocus={handleFocus}
        />
      ))}
    </Canvas>
  )
}
```

- [ ] **Step 3: Manual browser verification**

Run: `cd webapp && npm run dev`, open the printed localhost URL.
Expected: a rotating field of colored spheres (stars) with faint background points (dust); hovering a star enlarges/brightens it; clicking one does not yet open a reader (App.jsx wiring for that is Task 12) but should not throw a console error.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/camera/CameraRig.jsx webapp/src/three/Starfield.jsx
git commit -m "feat: add CameraRig and Starfield orchestrator wiring stars, dust, and camera"
```

---

### Task 10: ReaderPanel (restyled reader with morph-in transition)

**Files:**
- Create: `webapp/src/components/ReaderPanel.jsx`
- Delete: `webapp/src/components/Reader.jsx`

**Interfaces:**
- Consumes: `ago`, `tierTag`, `hl`, `bodyHtml`, `escapeHtml` from `lib.js` (unchanged, existing).
- Produces: `<ReaderPanel article={Article|null} onClose={()=>void} />` — same content/markup as the old `Reader.jsx` (exam rail, simple/plain-English list, key numbers, glossary terms, full body, sources, discussion, source button, disclaimer note — every field from `app/articles.json`'s schema, none dropped), wrapped in a Framer Motion `AnimatePresence`/`motion.div` that scales in from `0.85`→`1` opacity `0`→`1` (the "morph/cross-fade" from spec §4.4), instant (no animation) when `prefers-reduced-motion` is set.

- [ ] **Step 1: Install Framer Motion**

```bash
cd webapp && npm install framer-motion
```

- [ ] **Step 2: Create `webapp/src/components/ReaderPanel.jsx`**

```jsx
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ago, tierTag, hl, bodyHtml, escapeHtml } from '../lib.js'

function ExamRail({ a }) {
  const e = a.exam
  if (!e || e.relevance === 'none' || e.relevance === 'unscored') return null
  const facts = e.facts || []
  if (!facts.length && !e.drill) return null
  return (
    <aside className="examrail">
      <h3>For the exam</h3>
      {facts.map((f, i) => (
        <div className="efact" key={i}>
          <div className="ekind">{f.kind}</div>
          <div className="etext" dangerouslySetInnerHTML={{ __html: hl(escapeHtml(f.fact)) }} />
          <div className="eas">as of {f.as_of}</div>
        </div>
      ))}
      {e.drill && (
        <details className="edrill">
          <summary>Test yourself</summary>
          <p>{e.drill.q}</p>
          <ol>{(e.drill.options || []).map((o, i) => <li key={i}>{o}</li>)}</ol>
          <p className="eans">Answer: {String(e.drill.answer)}</p>
        </details>
      )}
    </aside>
  )
}

export default function ReaderPanel({ article, onClose, reducedMotion }) {
  useEffect(() => {
    document.body.style.overflow = article ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [article])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && article) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [article, onClose])

  const transition = reducedMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          className="reader-panel"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={transition}
        >
          <ReaderContent article={article} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ReaderContent({ article: a, onClose }) {
  const t = tierTag(a)
  const hasRail = a.exam && a.exam.relevance !== 'none' && a.exam.relevance !== 'unscored' &&
    ((a.exam.facts || []).length || a.exam.drill)

  return (
    <>
      <div className="rbar"><button className="back" onClick={onClose}>← Back</button></div>
      <article className={'art' + (hasRail ? '' : ' norail')}>
        {a.image_url && <img className="lead" src={a.image_url} alt="" onError={(e) => (e.target.style.display = 'none')} />}
        <div className="tagrow" style={{ marginTop: 16 }}>
          <span className="cat">{a.category}</span>
          {t.must && <span className="tag must">Must read</span>}
          <span className={'tag ' + t.cls}>{t.label}</span>
        </div>
        <h1>{a.title}</h1>
        <div className="byline">
          {a.source} · {ago(a.published)} · {a.read_min} min · {a.region === 'india' ? 'India' : 'Global'}
        </div>
        <ExamRail a={a} />
        {a.simple && a.simple.length > 0 && (
          <div className="simple">
            <h3>In plain English</h3>
            <ul>{a.simple.map((s, i) => <li key={i} dangerouslySetInnerHTML={{ __html: hl(escapeHtml(s)) }} />)}</ul>
          </div>
        )}
        {a.key_numbers && a.key_numbers.length > 0 && (
          <div className="nums">
            {a.key_numbers.map((n, i) => (
              <div className="num" key={i}><div className="v">{n.value}</div><div className="l">{n.label}</div></div>
            ))}
          </div>
        )}
        {a.terms && a.terms.length > 0 && (
          <div className="gloss">
            <h3>Words explained</h3>
            {a.terms.map((t2, i) => (
              <div className="gitem" key={i}><b>{t2.term}</b><span>{t2.meaning}</span></div>
            ))}
          </div>
        )}
        <details className="full">
          <summary>Read the full story</summary>
          <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml(a.body) }} />
        </details>
        {a.sources && a.sources.length > 0 && (
          <div className="verify">
            <h3>Checked against {a.sources.length} {a.sources.length === 1 ? 'source' : 'sources'}</h3>
            {a.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.source} ↗</a>
            ))}
          </div>
        )}
        {a.discussion && (
          <div className="verify">
            <h3>People are discussing this</h3>
            <a href={a.discussion.url} target="_blank" rel="noopener noreferrer">{a.discussion.title} ↗</a>
            <div className="note">{a.discussion.subreddit} · {a.discussion.score} points · {a.discussion.comments} comments</div>
          </div>
        )}
        <a className="srcbtn" href={a.url} target="_blank" rel="noopener noreferrer">Read the original ↗</a>
        <div className="note">
          Written for this digest from the reporting listed above. The plain-English summary and analysis are ours.
          Confidence shows how many independent publishers carried the story, not whether they are right. Not financial advice.
        </div>
      </article>
    </>
  )
}
```

- [ ] **Step 3: Delete the old reader**

```bash
git rm webapp/src/components/Reader.jsx
```

- [ ] **Step 4: Manual browser verification**

(Full wiring lands in Task 12; for now confirm the file compiles.)
Run: `cd webapp && npm run build`
Expected: build succeeds (App.jsx still imports the old `Home.jsx`/`Reader.jsx` at this point in the plan — if the build fails on a dangling import, temporarily comment out the unused import in `App.jsx` for this check only; Task 12 replaces `App.jsx` for real).

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/ReaderPanel.jsx webapp/package.json webapp/package-lock.json
git commit -m "feat: add ReaderPanel with morph-in transition, replacing Reader.jsx"
```

---

### Task 11: CategoryDock and RegionSwitcher (2D chrome)

**Files:**
- Create: `webapp/src/components/CategoryDock.jsx`
- Create: `webapp/src/components/RegionSwitcher.jsx`
- Test: `webapp/src/components/CategoryDock.test.jsx`
- Test: `webapp/src/components/RegionSwitcher.test.jsx`

**Interfaces:**
- Consumes: `CATEGORY_ORDER` from `lib.js`; `pullFactor`/`decayStrength` are used by the parent (`App.jsx`, Task 12), not by these components directly — `CategoryDock` only reports drag intent upward.
- Produces:
  - `<CategoryDock categories={string[]} active={string|null} onDragCategory={(category:string)=>void} onRelease={()=>void} />` — renders one blob per category; `onPointerDown`+drag toward center calls `onDragCategory(category)`; releasing calls `onRelease()`. Desktop only per spec §4.3 — mobile uses `MobileList.jsx`'s own chip row (Task 13), not this component.
  - `<RegionSwitcher region={'news'|'markets'|'glossary'} onSwitch={(region)=>void} />` — three buttons, `on` class on the active one.

- [ ] **Step 1: Write the failing tests — `webapp/src/components/RegionSwitcher.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RegionSwitcher from './RegionSwitcher.jsx'

describe('RegionSwitcher', () => {
  it('renders all three regions with the active one marked', () => {
    render(<RegionSwitcher region="markets" onSwitch={() => {}} />)
    expect(screen.getByRole('button', { name: /news/i })).not.toHaveClass('on')
    expect(screen.getByRole('button', { name: /markets/i })).toHaveClass('on')
    expect(screen.getByRole('button', { name: /glossary/i })).not.toHaveClass('on')
  })

  it('calls onSwitch with the clicked region', () => {
    const onSwitch = vi.fn()
    render(<RegionSwitcher region="news" onSwitch={onSwitch} />)
    fireEvent.click(screen.getByRole('button', { name: /glossary/i }))
    expect(onSwitch).toHaveBeenCalledWith('glossary')
  })
})
```

- [ ] **Step 2: Write the failing tests — `webapp/src/components/CategoryDock.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryDock from './CategoryDock.jsx'

describe('CategoryDock', () => {
  it('renders one blob per category', () => {
    render(<CategoryDock categories={['Markets', 'Sports']} active={null} onDragCategory={() => {}} onRelease={() => {}} />)
    expect(screen.getByText('Markets')).toBeInTheDocument()
    expect(screen.getByText('Sports')).toBeInTheDocument()
  })

  it('marks the active category', () => {
    render(<CategoryDock categories={['Markets', 'Sports']} active="Sports" onDragCategory={() => {}} onRelease={() => {}} />)
    expect(screen.getByText('Sports')).toHaveClass('active')
    expect(screen.getByText('Markets')).not.toHaveClass('active')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — neither component exists.

- [ ] **Step 4: Create `webapp/src/components/RegionSwitcher.jsx`**

```jsx
const REGIONS = [
  ['news', 'News'],
  ['markets', 'Markets'],
  ['glossary', 'Glossary'],
]

export default function RegionSwitcher({ region, onSwitch }) {
  return (
    <nav className="region-switcher">
      {REGIONS.map(([id, label]) => (
        <button key={id} className={region === id ? 'on' : ''} onClick={() => onSwitch(id)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Create `webapp/src/components/CategoryDock.jsx`**

```jsx
// Desktop-only gravity-drag filter dock (spec §4.3). Dragging a blob toward
// the dock's center reports the category as "active" to the parent, which
// feeds it into Starfield's pullFactor calls; releasing tells the parent to
// start decaying strength back to neutral (see gravity/gravityPull.js).
export default function CategoryDock({ categories, active, onDragCategory, onRelease }) {
  return (
    <div className="category-dock">
      {categories.map((cat) => (
        <button
          key={cat}
          className={'category-blob' + (cat === active ? ' active' : '')}
          onPointerDown={() => onDragCategory(cat)}
          onPointerUp={onRelease}
          onPointerLeave={onRelease}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/components/CategoryDock.jsx webapp/src/components/RegionSwitcher.jsx webapp/src/components/CategoryDock.test.jsx webapp/src/components/RegionSwitcher.test.jsx
git commit -m "feat: add CategoryDock (gravity-drag filter) and RegionSwitcher"
```

---

### Task 12: MarketsBelt and GlossaryNebula

**Files:**
- Create: `webapp/src/components/MarketsBelt.jsx`
- Create: `webapp/src/components/GlossaryNebula.jsx`
- Delete: `webapp/src/components/Markets.jsx`
- Delete: `webapp/src/components/Glossary.jsx`

**Interfaces:**
- Consumes: same `mkt`/`market`/`stamp` props the old `Markets.jsx` took; same `data` prop the old `Glossary.jsx` took.
- Produces: `<MarketsBelt mkt={object} market={string} stamp={string} />`, `<GlossaryNebula data={Article[]} />` — identical data logic to the deleted originals (index tiles, gainers/losers/actives/recent tables; unique-term glossary list with search), restyled to Violet Night classes only. Per spec §4.1, the "belt"/"nebula" framing is camera-position + background treatment done by the parent region wrapper in `App.jsx` (Task 13), not by these components — these two just need Violet Night styling, no new visual logic of their own.

- [ ] **Step 1: Create `webapp/src/components/MarketsBelt.jsx`**

```jsx
function pct(v) {
  return <span style={{ color: v >= 0 ? 'var(--mint)' : 'var(--coral)' }}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}
function n2(v) {
  return typeof v === 'number' && v >= 1000 ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(v)
}
function MTable({ title, items, sub }) {
  if (!items || !items.length) return null
  return (
    <div className="tbl">
      <h3>{title}</h3>
      {items.map((r, i) => (
        <div className="trow" key={i}>
          <div className="a"><div className="s">{r.name || r.symbol}</div><div className="u">{sub && r.sector ? r.sector : r.symbol}</div></div>
          <div className="b"><div className="pr">{n2(r.price)}</div><div className="ch">{pct(r.change_pct)}</div></div>
        </div>
      ))}
    </div>
  )
}

export default function MarketsBelt({ mkt, market, stamp }) {
  if (!mkt) return <div className="empty">Loading market data…</div>
  const m = mkt.markets[market]
  if (!m) return <div className="empty">No data.</div>
  const b = m.breadth || { up: 0, down: 0, total: 0 }
  const tot = Math.max(1, b.up + b.down)
  const ins = m.insight || { headline: '', body: '' }
  const sect = m.sectors && m.sectors.length
    ? [m.sectors[0], m.sectors[m.sectors.length - 1]].map((s) => ({
        name: s.sector, symbol: s.n + (s.n === 1 ? ' stock' : ' stocks'), price: '', change_pct: s.avg,
      }))
    : []

  return (
    <div className="mobile-list">
      <div className="idxgrid">
        {(m.indices || []).map((i, k) => (
          <div className="icard" key={k}><div className="n">{i.symbol}</div><div className="p">{n2(i.price)}</div><div className="c">{pct(i.change_pct)}</div></div>
        ))}
      </div>
      <div className="read">
        <h3>{ins.headline}</h3>
        <p>{ins.body}</p>
        <div>{b.up} up · {b.down} down of {b.total}</div>
      </div>
      <MTable title="Sectors — best and worst" items={sect} sub={false} />
      <MTable title="Top gainers" items={m.gainers} sub />
      <MTable title="Top losers" items={m.losers} sub />
      <MTable title="Most traded" items={m.actives} sub />
      <MTable title="Recently listed" items={m.recent} sub />
      <div className="note">Snapshot taken {stamp}, not a live feed. Data via Yahoo Finance. Not investment advice.</div>
    </div>
  )
}
```

- [ ] **Step 2: Create `webapp/src/components/GlossaryNebula.jsx`**

```jsx
import { useMemo, useState } from 'react'

export default function GlossaryNebula({ data }) {
  const [q, setQ] = useState('')
  const all = useMemo(() => {
    const seen = new Set(), out = []
    data.forEach((a) => {
      ;(a.terms || []).forEach((t) => {
        const k = t.term.toLowerCase()
        if (seen.has(k)) return
        seen.add(k)
        out.push({ term: t.term, meaning: t.meaning })
      })
    })
    out.sort((x, y) => x.term.localeCompare(y.term))
    return out
  }, [data])

  const f = q ? all.filter((t) => (t.term + ' ' + t.meaning).toLowerCase().includes(q.toLowerCase())) : all

  return (
    <div className="mobile-list">
      <input className="gsearch" placeholder="Search a word, e.g. WPI or hydraulic" value={q} onChange={(e) => setQ(e.target.value)} />
      {f.length
        ? f.map((t, i) => <div className="gitem" key={i}><b>{t.term}</b><span>{t.meaning}</span></div>)
        : <div className="empty">No match.</div>}
    </div>
  )
}
```

- [ ] **Step 3: Delete the old components**

```bash
git rm webapp/src/components/Markets.jsx webapp/src/components/Glossary.jsx
```

- [ ] **Step 4: Commit**

```bash
git add webapp/src/components/MarketsBelt.jsx webapp/src/components/GlossaryNebula.jsx
git commit -m "feat: add MarketsBelt and GlossaryNebula, replacing Markets.jsx/Glossary.jsx"
```

---

### Task 13: MobileList fallback

**Files:**
- Create: `webapp/src/components/MobileList.jsx`
- Test: `webapp/src/components/MobileList.test.jsx`

**Interfaces:**
- Consumes: `colorForCategory` (Task 2); `ago` (`lib.js`).
- Produces: `<MobileList articles={Article[]} briefs={Brief[]} categories={string[]} activeCategory={string|null} onSelectCategory={(c:string|null)=>void} onOpenArticle={(url:string)=>void} />` — a plain vertical-scroll list per spec §4.5: one `.mobile-chip` row for category tap-filtering, then one `.mobile-card` per article (colored dot via `colorForCategory`, title, source/age), briefs rendered as plain text rows beneath (no particle rendering — spec §4.5 explicitly rules this out for phones).

- [ ] **Step 1: Write the failing tests — `webapp/src/components/MobileList.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobileList from './MobileList.jsx'

const articles = [
  { url: 'a1', title: 'Story One', category: 'Sports', source: 'ET', published: new Date().toISOString() },
  { url: 'a2', title: 'Story Two', category: 'AI', source: 'Mint', published: new Date().toISOString() },
]

describe('MobileList', () => {
  it('renders a card per article', () => {
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={() => {}} onOpenArticle={() => {}} />)
    expect(screen.getByText('Story One')).toBeInTheDocument()
    expect(screen.getByText('Story Two')).toBeInTheDocument()
  })

  it('calls onOpenArticle with the url when a card is clicked', () => {
    const onOpen = vi.fn()
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={() => {}} onOpenArticle={onOpen} />)
    fireEvent.click(screen.getByText('Story One'))
    expect(onOpen).toHaveBeenCalledWith('a1')
  })

  it('calls onSelectCategory when a chip is tapped', () => {
    const onSelect = vi.fn()
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={onSelect} onOpenArticle={() => {}} />)
    fireEvent.click(screen.getByText('Sports'))
    expect(onSelect).toHaveBeenCalledWith('Sports')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test`
Expected: FAIL — `MobileList.jsx` does not exist.

- [ ] **Step 3: Create `webapp/src/components/MobileList.jsx`**

```jsx
import { colorForCategory } from '../theme.js'
import { ago } from '../lib.js'

// Touch fallback for <760px — spec §4.5. Same visual identity (category
// colors) as the desktop starfield, but a plain scroll list instead of
// drag-physics, because drag conflicts with vertical scroll on touch.
export default function MobileList({ articles, briefs, categories, activeCategory, onSelectCategory, onOpenArticle }) {
  const visibleArticles = activeCategory ? articles.filter((a) => a.category === activeCategory) : articles
  const visibleBriefs = activeCategory ? briefs.filter((b) => b.category === activeCategory) : briefs

  return (
    <div className="mobile-list">
      <div className="mobile-chip-row">
        <button className={'mobile-chip' + (activeCategory === null ? ' on' : '')} onClick={() => onSelectCategory(null)}>All</button>
        {categories.map((c) => (
          <button key={c} className={'mobile-chip' + (activeCategory === c ? ' on' : '')} onClick={() => onSelectCategory(c)}>{c}</button>
        ))}
      </div>
      {visibleArticles.map((a) => (
        <button key={a.url} className="mobile-card" onClick={() => onOpenArticle(a.url)}>
          <span className="dot" style={{ background: colorForCategory(a.category) }} />
          <span>
            <h4>{a.title}</h4>
            <p>{a.source} · {ago(a.published)}</p>
          </span>
        </button>
      ))}
      {visibleBriefs.length > 0 && (
        <>
          <h3 style={{ color: 'var(--faint)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', margin: '20px 0 10px' }}>In brief</h3>
          {visibleBriefs.map((b, i) => <p key={i} style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 10px' }}>{b.text}</p>)}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/MobileList.jsx webapp/src/components/MobileList.test.jsx
git commit -m "feat: add MobileList touch fallback for viewports under 760px"
```

---

### Task 14: App.jsx integration (full rewrite) and cleanup of superseded files

**Files:**
- Modify: `webapp/src/App.jsx` (full rewrite)
- Delete: `webapp/src/Hero3D.jsx`
- Delete: `webapp/src/components/Cards.jsx`
- Delete: `webapp/src/components/Home.jsx`

**Interfaces:**
- Consumes every component from Tasks 2–13: `useRenderTier` (Task 3), `Starfield` (Task 9), `ReaderPanel` (Task 10), `CategoryDock`/`RegionSwitcher` (Task 11), `MarketsBelt`/`GlossaryNebula` (Task 12), `MobileList` (Task 13), `OnboardingHint` (Task 6), `decayStrength` (Task 5), `CATEGORY_ORDER` (`lib.js`).
- Produces: the app's root component — no external consumers.

- [ ] **Step 1: Replace `webapp/src/App.jsx` in full**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import Starfield from './three/Starfield.jsx'
import ReaderPanel from './components/ReaderPanel.jsx'
import CategoryDock from './components/CategoryDock.jsx'
import RegionSwitcher from './components/RegionSwitcher.jsx'
import MarketsBelt from './components/MarketsBelt.jsx'
import GlossaryNebula from './components/GlossaryNebula.jsx'
import MobileList from './components/MobileList.jsx'
import OnboardingHint from './components/OnboardingHint.jsx'
import { useRenderTier } from './device.js'
import { decayStrength } from './gravity/gravityPull.js'
import { CATEGORY_ORDER } from './lib.js'

function readReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function App() {
  const tier = useRenderTier() // 'full' | 'reduced' | 'mobile'
  const reducedMotion = tier === 'reduced' || readReducedMotion()

  const [digest, setDigest] = useState(null)
  const [mkt, setMkt] = useState(null)
  const [error, setError] = useState(null)
  const [region, setRegion] = useState('news')
  const [activeCategory, setActiveCategory] = useState(null)
  const [pullStrength, setPullStrength] = useState(0)
  const [openUrl, setOpenUrl] = useState(null)
  const decayRef = useRef(null)

  useEffect(() => {
    fetch('articles.json?t=' + Date.now()).then((r) => r.json()).then(setDigest).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (region !== 'markets' || mkt) return
    fetch('markets.json?t=' + Date.now()).then((r) => r.json()).then(setMkt).catch((e) => setError(e.message))
  }, [region, mkt])

  const data = digest?.articles || []
  const briefs = digest?.briefs || []
  const wire = digest?.wire || []

  const categories = useMemo(() => {
    const have = new Set(data.map((a) => a.category))
    return CATEGORY_ORDER.filter((k) => have.has(k))
  }, [data])

  // Gravity-drag: dragging sets strength to 1 immediately; releasing starts
  // an exponential decay back to 0 each animation frame (spec §4.3).
  function handleDragCategory(category) {
    setActiveCategory(category)
    setPullStrength(1)
    if (decayRef.current) cancelAnimationFrame(decayRef.current)
  }
  function handleRelease() {
    let last = performance.now()
    function tick(now) {
      const dt = (now - last) / 1000
      last = now
      setPullStrength((s) => {
        const next = decayStrength(s, dt)
        if (next < 0.02) {
          setActiveCategory(null)
          return 0
        }
        decayRef.current = requestAnimationFrame(tick)
        return next
      })
    }
    decayRef.current = requestAnimationFrame(tick)
  }

  const openArticle = data.find((a) => a.url === openUrl) || null

  if (error) return <div className="empty">Could not load.<br />{error}</div>
  if (!digest) return <div className="empty">Loading…</div>

  if (tier === 'mobile') {
    return (
      <>
        <RegionSwitcher region={region} onSwitch={setRegion} />
        {region === 'news' && (
          <MobileList
            articles={data} briefs={briefs} categories={categories}
            activeCategory={activeCategory} onSelectCategory={setActiveCategory}
            onOpenArticle={setOpenUrl}
          />
        )}
        {region === 'markets' && <MarketsBelt mkt={mkt} market="india" stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} />}
        {region === 'glossary' && <GlossaryNebula data={data} />}
        <ReaderPanel article={openArticle} onClose={() => setOpenUrl(null)} reducedMotion />
        <OnboardingHint />
      </>
    )
  }

  return (
    <>
      {region === 'news' && (
        <Starfield
          articles={data} briefs={briefs} wire={wire}
          activeCategory={activeCategory} pullStrength={pullStrength}
          onOpenArticle={setOpenUrl} reducedMotion={reducedMotion}
        />
      )}
      {region === 'markets' && <div className="chrome"><MarketsBelt mkt={mkt} market="india" stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} /></div>}
      {region === 'glossary' && <div className="chrome"><GlossaryNebula data={data} /></div>}
      <div className="chrome">
        <RegionSwitcher region={region} onSwitch={setRegion} />
        {region === 'news' && (
          <CategoryDock categories={categories} active={activeCategory} onDragCategory={handleDragCategory} onRelease={handleRelease} />
        )}
      </div>
      <ReaderPanel article={openArticle} onClose={() => setOpenUrl(null)} reducedMotion={reducedMotion} />
      <OnboardingHint />
    </>
  )
}
```

- [ ] **Step 2: Delete superseded files**

```bash
git rm webapp/src/Hero3D.jsx webapp/src/components/Cards.jsx webapp/src/components/Home.jsx
```

- [ ] **Step 3: Full test suite**

Run: `cd webapp && npm test`
Expected: all tests from Tasks 1–13 PASS.

- [ ] **Step 4: Production build**

Run: `cd webapp && npm run build`
Expected: build succeeds, writes into `../app/` per the existing `vite.config.js` (unchanged).

- [ ] **Step 5: Manual browser verification — desktop (≥1180px)**

Run: `cd newss/app && python -m http.server 8899`, open `http://localhost:8899/index.html`.
Expected, checked one at a time:
- A starfield renders with no console errors.
- Hovering a star enlarges/glows it.
- Dragging a category dock blob dims non-matching stars and brightens matching ones; releasing lets it decay back over ~1-2 seconds.
- Clicking a star opens `ReaderPanel` with a scale/fade transition; the exam rail (if present) sits in the right-hand column exactly as before (this is the exact bug class from the previous redesign — verify with `getBoundingClientRect()` that the rail's `top` is near the article top, not hundreds of pixels down).
- `RegionSwitcher` correctly swaps between the starfield, `MarketsBelt`, and `GlossaryNebula`.
- The onboarding hint appears once, and not again after a reload (check `localStorage`).

- [ ] **Step 6: Manual browser verification — mobile (390×844)**

Resize (or use device emulation) to 390px wide, reload.
Expected: `MobileList` renders instead of the canvas, category chips filter the list, tapping a card opens `ReaderPanel`, no WebGL canvas is mounted at all (confirm via `document.querySelector('canvas')` returning `null` in this viewport).

- [ ] **Step 7: Manual verification — reduced motion**

In DevTools, emulate `prefers-reduced-motion: reduce`, reload at desktop width.
Expected: stars render at static positions (no idle drift), `ReaderPanel` opens/closes instantly (no scale/fade animation), category-dock decay is still functionally correct but need not visibly ease.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/App.jsx
git commit -m "feat: wire constellation redesign into App.jsx, remove superseded components"
```

---

### Task 15: Deploy build

**Files:**
- Modify: `app/index.html`, `app/assets/*` (build output — not hand-edited, per existing `routine.md` convention)

**Interfaces:** none — this task only runs the existing build and verifies the output.

- [ ] **Step 1: Rebuild into `app/`**

Run: `cd webapp && npm run build`
Expected: `../app/index.html` and `../app/assets/*` updated; `../app/articles.json` and `../app/markets.json` untouched (confirm with `git status` showing no changes to those two files).

- [ ] **Step 2: Final full-suite check**

Run: `cd webapp && npm test && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit the build output**

```bash
cd newss
git add app/index.html app/assets
git commit -m "chore: rebuild app/ with constellation redesign"
```

- [ ] **Step 4: Report to the user, do NOT push**

Pushing `master` auto-deploys to GitHub Pages immediately (per project convention) — stop here and let the user review locally (Task 14 Steps 5-7's checks) before asking them to confirm the push, exactly as was done for the previous R3F redesign.

---

## Self-Review Notes

- **Spec coverage:** §3 palette → Task 2/7. §4.1 three-region camera → Task 9 (`Starfield`) + Task 12 (`MarketsBelt`/`GlossaryNebula`) + Task 14 (region switch wiring). §4.2 star/dust tiering → Task 8/9. §4.3 gravity drag → Task 5/11/14. §4.4 reader morph → Task 10. §4.5 mobile fallback → Task 13/14. §5 tech approach (device tiers, instanced dust, camera state machine) → Task 3/4/8/9. §7 onboarding risk → Task 6. All covered.
- **Placeholder scan:** no TBD/TODO; every step has literal code, not descriptions.
- **Type consistency:** `pullFactor({itemCategory, activeCategory, strength})` signature matches between Task 5's definition and Task 8/9's usage. `cameraReducer(state, action)` action shapes match between Task 4 and Task 9's `dispatch` calls. `colorForCategory`/`sizeForArticle` signatures match between Task 2 and Tasks 8/13. `pickRenderTier`/`useRenderTier` match between Task 3 and Task 14.
