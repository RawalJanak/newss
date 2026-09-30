# Classic newspaper theme, page-flip navigation, headline photos

## Goal

Replace MyNews's current "Violet Night" dark-purple card-feed theme with an
authentic vintage newspaper look: cream newsprint background, black ink
type, a double-rule masthead, drop-capped lead stories, and hairline
dividers instead of rounded cards. Two behavioural additions ride along:
tab switches turn like a physical page instead of cross-fading, and
headlines carry real photos (color, not sepia/grayscale). The Obsidian
graph's own dark canvas and colored nodes are explicitly exempt from the
retheme — approved in the mockup review as staying exactly as-is inside
the newsprint frame.

Three design directions were mocked up live (in-browser, using this
edition's real headlines) and reviewed with the user: Broadsheet Classic,
Modern Broadsheet, and Tabloid Bold. The user chose the full vintage
direction (closest to Broadsheet Classic) over the softer Modern
Broadsheet hybrid, then asked for two refinements confirmed in follow-up
mockups: full-color photography (the first pass had sepia/grayscale
filtering, rejected) and the Obsidian graph kept in its native colors
(not converted to newsprint monochrome).

## Scope

**In scope:**
- Global CSS custom-property retheme (`webapp/src/styles.css` `:root` and
  `:root[data-theme="light"]` blocks) to the newsprint palette, for both
  the light and dark theme toggle states (see Theme States below).
- Masthead redesign in `App.jsx`'s `.bar` header: double-rule border,
  serif wordmark, dateline strip, kicker-style stamp line.
- Page-flip transition when switching tabs (`switchTab` in `App.jsx`),
  replacing the current instant tab swap with a hinged 3D turn.
- Headline photography: render `article.image_url` at full color in
  `CardFeed.jsx`'s card variants (already conditionally rendered today,
  see Data Note below) and add a lead-image treatment for the top story
  in `ImportantSection.jsx`.
- Card/list dividers across existing components (`CardFeed.jsx`,
  `ImportantSection.jsx`, `MarketsBelt.jsx`, `TrendingSection.jsx`,
  `GlossaryNebula.jsx`) restyled from rounded surface cards to hairline
  rule dividers, following the mockup's `.nd-card` pattern.
- `ObsidianGraph.jsx` and its `.odetail` panel: explicitly excluded from
  the retheme. Its canvas keeps `background:#000` and existing node/edge
  colors regardless of the page theme, exactly as shown in the approved
  mockup (SVG graph rendered unchanged inside the newsprint page frame).

**Out of scope (separate future work, not blocking this spec):**
- Backfilling `image_url` into past archived editions -- only new
  editions going forward will carry real photos.
- Any change to `routine.md`'s editorial content (headlines, article
  bodies, exam blocks) -- this is a visual and interaction layer change
  only.
- The map/network toggle feature (`ObsidianMap.jsx`, `graphShared.jsx`,
  `worldMap.js`) -- stays untouched and unused per its existing deferred
  status.

## Data note: images already flow, they were just never populated

`CardFeed.jsx` already renders `article.image_url` conditionally
(`{a.image_url && <img ... />}`) in all three of its card variants, and
`news_fetcher.fetch_headlines()` already returns a real `image_url` for
most RSS items (roughly half, in a spot-check of a recent fetch). The
reason no edition has shown images to date is that every edition's
hand-assembled `articles.json` has written `"image_url": ""` for deep-tier
articles instead of carrying over the real value from the fetched item.

This spec fixes the display side (full color, sized correctly in the new
layout). The pipeline side -- writing the real `image_url` when hand-
authoring an edition's deep-tier articles -- is a one-line discipline
change to how future editions get assembled, not a code change under this
spec, and is called out here so it isn't lost.

## Theme states

The existing light/dark toggle (`--theme` attribute, the `round` header
button) stays. Both states become newspaper variants rather than one
newspaper theme plus the old purple dark mode:

- **Day Edition** (current `:root[data-theme="light"]`, becomes new
  default): cream newsprint (`--bg:#F1EAD6`-family), black ink text,
  black rules -- the palette validated in the mockups.
- **Night Edition** (current `:root` default, becomes the dark toggle
  state): a dark ink-wash variant -- near-black background, parchment/
  off-white ink, the same double-rule masthead and hairline dividers,
  keeping the newspaper identity instead of reverting to the old purple
  palette. Exact dark-variant values are a judgment call for the
  implementer to make consistently with the day palette's contrast
  ratios; not separately mocked up, since the user's approval was on the
  day/light look shown in the browser.

This is the one place this spec makes an assumption beyond what was
directly shown and approved: that "authentic newspaper" should apply to
both toggle states rather than removing the toggle or leaving dark mode
as the old purple theme. Flagged for the user's sign-off when reviewing
this spec.

## Masthead

Replaces the current `.bar` (`brand` + round buttons + `stamp` + `pills`)
structure:

```
┌─────────────────────────────────────────┐
│         VOL. 1 · NO. 214 · FREE          │   kicker, centered, small caps
│              The MyNews                  │   serif wordmark, large
│   TUESDAY, 30 SEPTEMBER 2026 · 12 STORIES │   dateline, rules above+below
├───────────────────────────────────────────┤   double rule
│  Home   Markets   Words   Obsidian  Trend │   tab nav, on this page-flips
└───────────────────────────────────────────┘
```

The theme toggle and refresh buttons move to small text links inside the
dateline row (e.g. "Night Edition" / "Refresh") rather than floating
round icon buttons, consistent with a masthead having no iconography.
Category pills (Markets tab's India/USA/China/Global switcher, Home tab's
category filter) keep their current underlying logic, restyled as
underlined text tabs instead of pill buttons.

## Page-flip mechanic

Applies to the five bottom-nav tabs (Home, Markets, Words, Obsidian,
Trending). Implementation: `App.jsx` keeps its existing `tab` state, but
`switchTab` no longer swaps `tab` synchronously -- it triggers a CSS 3D
transform (`transform-origin: left center`, `rotateY(-155deg)`,
`perspective` on the containing wrap) on the currently-visible tab's
content, and after a fixed transition duration (~620ms, matching the
approved mockup's easing) swaps `tab` to the target and resets the
transform instantly (`transition: none` for one frame, matching the
mockup's `pfGoto` pattern) so the new content is ready to flip again next
time.

Both the outgoing and incoming tab content must exist in the DOM
simultaneously for the duration of the flip (the incoming page is what
gets revealed underneath as the outgoing page turns away) -- this is a
real change to how `App.jsx` conditionally renders tab content today (a
single `tab === 'x' ? ... : ...` chain), needing two mounted panels
during the transition window instead of one. `prefers-reduced-motion`
must collapse this to an instant swap, no transform, per the project's
existing accessibility posture (see `oedge`/`onode` animation handling in
`ObsidianGraph.jsx` for the established pattern of gating on that media
query).

## Typography and color tokens

Reuses the already-loaded `Newsreader` serif (no new font dependency) as
the sole display and body face, replacing the current sans-serif body
text -- an authentic newspaper sets body copy in serif, not sans. Georgia
stays as the existing fallback in the `--serif` stack. The `--sans`
token, still used for a handful of small metadata strings in the
mockups (bylines, source names), stays available but is no longer the
primary body font.

Color tokens (Day Edition, exact values to carry into `:root[data-theme="light"]`):
- `--bg: #F1EAD6` (newsprint cream)
- `--ink: #181510` (near-black ink, not pure `#000`)
- `--muted: #5a5340`, `--faint: #79705c` (aged-paper grays)
- `--line: #181510` (rule lines, full-strength), `--line-soft: #a89f86`
  (hairline dividers between cards)
- `--accent: #7a3226` (the mockups' single warm red-brown used for
  kickers and the wordmark's italic word) -- kept as the one accent
  color per the existing codebase's single-accent convention
- `--up` / `--down` (Markets gainers/losers) keep the existing green/red
  semantics, recalibrated to sit correctly against the cream background
  rather than the old dark background

## Testing

- `npm run build`, then visually verify (Playwright against the built
  `app/`, same pattern already used in this project for the Obsidian
  timeline work) that: the masthead renders correctly, page-flip
  triggers on each of the five tab buttons and settles cleanly, a card
  with a real `image_url` shows it in full color, and the Obsidian tab's
  graph canvas is unaffected by the theme (still dark, still colored
  nodes) inside the newsprint frame.
- Toggle to Night Edition and re-verify contrast and the masthead/flip
  mechanic still work in the dark variant.
- Confirm `prefers-reduced-motion` collapses the page-flip to an instant
  swap (DevTools emulation).
- Existing test suite (`python -m pytest -q`) is unaffected -- this is a
  frontend-only change, no Python pipeline code touched.
