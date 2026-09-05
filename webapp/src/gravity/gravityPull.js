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
