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
