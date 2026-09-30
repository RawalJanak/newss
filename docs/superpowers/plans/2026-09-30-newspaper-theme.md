# Classic Newspaper Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin MyNews from its dark "Violet Night" palette to an authentic newspaper look (cream/dark newsprint, black ink, serif body type, double-rule masthead, hairline-divider cards) and add a page-flip transition between tabs, with headline photography restored in full color.

**Architecture:** Nearly every visual element in this app already reads its color from CSS custom properties defined once in `:root` / `:root[data-theme="light"]` (`webapp/src/styles.css:1-25`), so retheming is mostly a token swap. Three things need real code beyond tokens: the masthead markup (`App.jsx`'s `.bar`), the page-flip transition (`App.jsx`'s tab-switch logic, currently an instant conditional swap), and flattening the ~12 components that use `border-radius` + `box-shadow:var(--lift)` "card chrome" into the newspaper's flat hairline-divider look (the ones that already use `border-bottom:1px solid var(--line-soft)` rows -- `.brow`, `.wrow`, `.trow`, `.trendlist li` -- need no structural change, only new token colors).

**Tech Stack:** Plain CSS custom properties, React (no Tailwind, no new dependencies), the existing `Newsreader` Google Font already loaded.

**Spec:** `docs/superpowers/specs/2026-09-30-newspaper-theme-design.md`

## Global Constraints

- No new npm dependencies. No new web fonts -- reuse `Newsreader` (already loaded) as the sole serif for both display and body text.
- Both theme-toggle states become newspaper variants: Day Edition (light, cream/black ink) and Night Edition (dark, ink-wash/parchment) -- neither state reverts to the old purple "Violet Night" palette.
- `ObsidianGraph.jsx` and its `.odetail` panel are explicitly out of scope for color changes -- the graph canvas keeps `background:#000` and its existing node/edge colors regardless of page theme.
- `prefers-reduced-motion: reduce` must collapse the page-flip to an instant tab swap -- this app already has a global rule for this at `styles.css:364`, the page-flip CSS must respect it.
- No change to `routine.md`, Python pipeline code, or any `.json` data file -- this is a `webapp/src/` frontend-only change.

## Review Focus

- **A tab has no `image_url` on any article** (most brief/wire-only tabs, or an edition where photos weren't populated) -- the masthead and card layout must not leave a visible gap or broken-image icon; `CardFeed.jsx`'s existing `{a.image_url && <img .../>}` guard already handles this, but the new card CSS must not assume an image is always present.
- **Rapid repeated tab clicks during an in-flight page-flip** -- clicking a second tab before the first flip's `setTimeout` fires must not leave two tabs' content stuck visible or the transform in a broken half-flipped state.
- **`prefers-reduced-motion: reduce`** -- the flip must not play at all, only an instant content swap (see Global Constraints).
- **Night Edition contrast** -- the dark newspaper variant's ink-on-background contrast must still meet the same readability bar as the old dark theme, not just "dark and vaguely papery."
- **Wide-screen breakpoints** (`styles.css:307`, `:328`) already restyle `.hero`, `.rail`, `.tabbar` for tablet/desktop -- the masthead and page-flip changes must still look correct at those breakpoints, not just on the phone-width layout the mockups were built at.

---

## Task 1: Retheme design tokens and body typography

**Files:**
- Modify: `webapp/src/styles.css:1-33`

**Interfaces:**
- Produces: the token set every later task and every existing component reads via `var(--bg)`, `var(--ink)`, `var(--surface)`, `var(--line)`, `var(--line-soft)`, `var(--accent)`, `var(--muted)`, `var(--faint)`, `var(--up)`, `var(--down)`, `var(--serif)`. No task after this one changes these names -- only the CSS that consumes them.

- [ ] **Step 1: Replace the `:root` (Night Edition) and `:root[data-theme="light"]` (Day Edition) blocks**

Replace `webapp/src/styles.css:1-25` with:

```css
/* Newspaper theme. Day Edition (light) is the default; Night Edition
   (dark) is the opt-in variant via the theme toggle. Both are newsprint
   palettes -- neither reverts to a generic dark-app theme. */
:root[data-theme="light"], :root:not([data-theme]) {
  --bg:#F1EAD6; --surface:#F1EAD6; --elev:#FAF6EA; --sunken:#E7DFC7;
  --ink:#181510; --muted:#5a5340; --faint:#79705c;
  --line:#181510; --line-soft:#a89f86;
  --accent:#7a3226; --accent-dim:#c9a99a; --accent-ink:#F1EAD6;
  --accent-wash:rgba(122,50,38,.10);
  --hot:#7a3226; --hot-wash:rgba(122,50,38,.10);
  --up:#2f6b3f; --down:#a3402b;
  --lift:none;
  --serif:'Newsreader', Georgia, 'Times New Roman', serif;
  --sans:'Newsreader', Georgia, 'Times New Roman', serif;
  --w:680px; --ease:cubic-bezier(.22,.61,.36,1);
}
:root[data-theme="dark"] {
  --bg:#171410; --surface:#171410; --elev:#211D17; --sunken:#0E0C09;
  --ink:#EFE7D6; --muted:#B3A98E; --faint:#847A62;
  --line:#EFE7D6; --line-soft:#4A4334;
  --accent:#D98C6E; --accent-dim:#5A4436; --accent-ink:#171410;
  --accent-wash:rgba(217,140,110,.12);
  --hot:#D98C6E; --hot-wash:rgba(217,140,110,.12);
  --up:#6FBF8B; --down:#E0846B;
  --lift:none;
}
```

Note the selector change: the old code used a bare `:root` as the dark
default and `:root[data-theme="light"]` as the opt-in. This plan flips
that -- light (Day Edition) is now the default (`:root:not([data-theme])`
falls back to it), and `[data-theme="dark"]` is the explicit opt-in. This
matches the spec's "Day Edition becomes the new default" requirement.

- [ ] **Step 2: Update the theme-toggle logic in `App.jsx` to match the new default**

In `webapp/src/App.jsx`, find this block (currently around line 111):

```jsx
<button className="round" aria-label="Switch theme" onClick={() => setTheme((t) => ((t || 'dark') === 'dark' ? 'light' : 'dark'))}>☾</button>
```

Replace with:

```jsx
<button className="round" aria-label="Switch theme" onClick={() => setTheme((t) => ((t || 'light') === 'light' ? 'dark' : 'light'))}>☾</button>
```

This is a one-line default flip: previously the app defaulted to `'dark'`
when no theme was stored, now it defaults to `'light'` (Day Edition),
matching the new CSS default in Step 1. (This button's markup itself is
replaced in Task 2 -- this step only fixes the toggle's default value so
Task 2's markup change starts from correct behavior.)

- [ ] **Step 3: Set body font to the serif token**

In `webapp/src/styles.css`, find (around the old line 30, now shifted by
the Step 1 edit -- search for the `body {` rule instead of using a line
number):

```css
body {
  background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:16px;
```

Change `font-family:var(--sans)` to `font-family:var(--serif)`:

```css
body {
  background:var(--bg); color:var(--ink); font-family:var(--serif); font-size:16px;
```

- [ ] **Step 4: Build and visually verify the token change**

```bash
cd webapp && npm run build
```

Then serve `app/` locally (e.g. `cd ../app && python -m http.server 8899`)
and open it in a browser. Confirm: page background is cream, all text is
in the `Newsreader` serif, no purple remains anywhere. Toggle the theme
button and confirm the page switches to the dark ink-wash Night Edition
instead of the old purple dark theme.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/styles.css webapp/src/App.jsx
git commit -m "feat: retheme to newspaper palette (Day/Night Edition)"
```

---

## Task 2: Masthead and tab-nav restyle

**Files:**
- Modify: `webapp/src/App.jsx:106-133` (the `.bar` block)
- Modify: `webapp/src/styles.css` (the `/* ---------- top bar ---------- */` and `/* ---------- pills ---------- */` sections)

**Interfaces:**
- Consumes: tokens from Task 1 (`--line`, `--serif`, `--accent`, `--faint`).
- Produces: no new state or props -- this task only changes markup and CSS inside `App.jsx`'s existing `theme`, `stamp`, `region`, `cat`, `categories`, `market` variables, all already defined.

- [ ] **Step 1: Replace the masthead JSX**

In `webapp/src/App.jsx`, replace the entire block from `<div className="bar">`
through its closing `</div>` (lines 108-133) with:

```jsx
<div className="bar">
  <div className="mast">
    <div className="mast-kicker">Vol. 1 &middot; Daily Edition</div>
    <div className="brand">My<em>News</em></div>
    <div className="mast-dateline">
      <span>{stamp}</span>
      <span className="mast-links">
        <button onClick={() => setTheme((t) => ((t || 'light') === 'light' ? 'dark' : 'light'))}>
          {(theme || 'light') === 'light' ? 'Night Edition' : 'Day Edition'}
        </button>
        <button onClick={() => location.reload()}>Refresh</button>
      </span>
    </div>
  </div>
  <div className="pills">
    {tab === 'home' && (
      <>
        {['all', 'india', 'global'].map((r) => (
          <button key={r} className={'pill' + (region === r ? ' on' : '')} onClick={() => pick(() => setRegion(r))}>
            {r === 'all' ? 'All news' : r === 'india' ? 'India' : 'Global'}
          </button>
        ))}
        <button className={'pill' + (cat === 'All' ? ' on' : '')} onClick={() => pick(() => setCat('All'))}>Everything</button>
        {categories.map((k) => (
          <button key={k} className={'pill' + (cat === k ? ' on' : '')} onClick={() => pick(() => setCat(k))}>{k}</button>
        ))}
      </>
    )}
    {tab === 'markets' && MARKET_OPTIONS.map(([id, label]) => (
      <button key={id} className={'pill' + (market === id ? ' on' : '')} onClick={() => pick(() => setMarket(id))}>{label}</button>
    ))}
  </div>
</div>
```

This removes the old round icon buttons and the separate `.stamp` div,
folding theme-toggle, refresh, and the timestamp into one dateline row
under the masthead. It also drops the flag emoji from the region pill
labels (`🇮🇳 India` -> `India`) since a newspaper masthead doesn't carry
emoji.

- [ ] **Step 2: Replace the top-bar and pills CSS**

In `webapp/src/styles.css`, replace the `/* ---------- top bar ---------- */`
section (the `.bar`, `.bar .in`, `.brand`, `.brand em`, `.round`, `.stamp`
rules) with:

```css
/* ---------- masthead ---------- */
.bar { position:sticky; top:0; z-index:40; background:var(--bg); padding-top:env(safe-area-inset-top); }
.mast { max-width:var(--w); margin:0 auto; padding:16px 18px 10px; text-align:center; border-bottom:4px double var(--line); }
.mast-kicker { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--faint); }
.brand { font-family:var(--serif); font-size:34px; font-weight:700; letter-spacing:-.01em; margin:3px 0; }
.brand em { font-style:normal; color:var(--accent); }
.mast-dateline { display:flex; justify-content:space-between; align-items:center; gap:12px;
                  font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--faint);
                  border-top:1px solid var(--line); padding-top:5px; margin-top:6px; }
.mast-links { display:flex; gap:14px; }
.mast-links button { font:inherit; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase;
                      color:var(--accent); text-decoration:underline; text-underline-offset:2px; }
```

Then replace the `/* ---------- pills ---------- */` section with:

```css
/* ---------- pills ---------- */
.pills { display:flex; gap:18px; overflow-x:auto; scrollbar-width:none; padding:10px 18px 12px;
         max-width:var(--w); margin:0 auto; border-bottom:1px solid var(--line-soft); }
.pills::-webkit-scrollbar { display:none; }
.pill { flex:none; padding:4px 0; font-size:12.5px; font-weight:600; letter-spacing:.02em;
        color:var(--faint); border-bottom:2px solid transparent; }
.pill.on { color:var(--ink); border-bottom-color:var(--accent); font-weight:700; }
```

This drops the pill background/border-radius entirely -- pills are now
underlined text tabs, matching the mockup's nav row style, not rounded
buttons.

- [ ] **Step 3: Build and visually verify**

```bash
cd webapp && npm run build
```

Serve and open `app/` as in Task 1. Confirm: masthead shows a small-caps
kicker line, large serif "MyNews" wordmark, a double rule below it, and a
dateline row with "Night Edition" / "Refresh" as underlined text links.
Category/region pills render as underlined text tabs, not pill buttons.
Click "Night Edition" and confirm it toggles to the dark variant and the
button label flips to "Day Edition".

- [ ] **Step 4: Commit**

```bash
git add webapp/src/App.jsx webapp/src/styles.css
git commit -m "feat: newspaper masthead, text-tab nav"
```

---

## Task 3: Flatten rounded surface cards to hairline dividers

**Files:**
- Modify: `webapp/src/styles.css` (the hero, carousel, list-card, important, markets-index, reader, glossary, and wire `summary` rules)

**Interfaces:**
- Consumes: tokens from Task 1. No JSX changes in this task -- every
  affected component (`CardFeed.jsx`, `ImportantSection.jsx`,
  `MarketsBelt.jsx`, `ReaderPanel.jsx`, `GlossaryNebula.jsx`) already
  renders the exact class names this task restyles; only their CSS rules
  change.
- Produces: nothing new consumed by later tasks -- this task's output is
  purely visual and is the last styling pass before Task 4's behavioral
  change.

- [ ] **Step 1: Flatten `.hero`, `.rcard`, `.lcard`**

In `webapp/src/styles.css`, in the `/* ---------- hero ---------- */` and
`/* ---------- carousel ---------- */` and `/* ---------- list card ---------- */`
sections, remove `border-radius` and `box-shadow:var(--lift)` from `.hero`,
`.rcard`, and `.lcard`, and replace their `background:var(--surface)` +
`border:1px solid var(--line)` framing with a bottom-rule divider instead
of a boxed card. Specifically:

Change:
```css
.hero { display:block; width:100%; text-align:left; position:relative; border-radius:20px; overflow:hidden;
        background:var(--surface); box-shadow:var(--lift); margin-bottom:8px; aspect-ratio:4/5; max-height:460px; }
```
to:
```css
.hero { display:block; width:100%; text-align:left; position:relative; overflow:hidden;
        background:var(--surface); margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--line-soft);
        aspect-ratio:4/5; max-height:460px; }
```

Change:
```css
.rcard { flex:none; width:210px; scroll-snap-align:start; text-align:left; background:var(--surface);
         border:1px solid var(--line); border-radius:16px; overflow:hidden; box-shadow:var(--lift); }
```
to:
```css
.rcard { flex:none; width:210px; scroll-snap-align:start; text-align:left; background:var(--surface);
         border-right:1px solid var(--line-soft); padding-right:14px; }
```

Change:
```css
.lcard { display:flex; gap:13px; width:100%; text-align:left; align-items:flex-start; background:var(--surface);
         border:1px solid var(--line); border-radius:16px; padding:13px; margin-bottom:12px; box-shadow:var(--lift); }
.lcard.hot { border-color:var(--accent-dim); background:linear-gradient(180deg, var(--accent-wash), transparent 70%), var(--surface); }
```
to:
```css
.lcard { display:flex; gap:13px; width:100%; text-align:left; align-items:flex-start; background:var(--surface);
         border-bottom:1px solid var(--line-soft); padding:13px 0; margin-bottom:0; }
.lcard.hot { background:var(--accent-wash); }
```

Also remove the `border-radius:12px` from `.lcard img` (keep the rest of
that rule as-is -- image sizing is unaffected, only its rounded corners
go): change `.lcard img { width:92px; height:92px; object-fit:cover; border-radius:12px; flex:none; background:var(--sunken); }`
to `.lcard img { width:92px; height:92px; object-fit:cover; flex:none; background:var(--sunken); }`.

- [ ] **Step 2: Flatten `.impcard`, `.icard`, `.num`, `.gitem`, `.simple`, `.read`, `.verify`, `.examrail`**

For each of these rules in `webapp/src/styles.css`, remove `border-radius`
and (where present) `box-shadow`, and change `border:1px solid var(--line)`
(or the hot/accent-tinted border variants) to `border-bottom:1px solid var(--line-soft)`
with `margin-bottom` reduced to match a flat list rhythm (`10px` or the
existing value, whichever the rule already used). Concretely:

```css
.impcard { display:flex; gap:11px; align-items:flex-start; background:var(--surface);
           border-bottom:1px solid var(--line-soft); padding:12px 0; margin-bottom:0; text-decoration:none; color:var(--ink); }
.icard { background:var(--surface); border-bottom:1px solid var(--line-soft); padding:14px 0; }
.num { background:var(--surface); border-bottom:1px solid var(--line-soft); padding:13px 0; }
.gitem { background:var(--surface); border-bottom:1px solid var(--line-soft); padding:12px 0; margin-bottom:0; }
.simple { background:var(--accent-wash); border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:18px 0 20px; margin-bottom:20px; }
.read { background:var(--accent-wash); border-top:3px double var(--line); padding:18px 0; margin-bottom:22px; }
.verify { background:var(--surface); border-top:1px solid var(--line); padding:15px 0; margin-bottom:18px; }
.examrail { background:var(--surface); border-top:3px double var(--line); padding:16px 0 18px; margin:22px 0; }
```

- [ ] **Step 3: Flatten `details.full > summary` and `.wire > summary`**

Change:
```css
details.full > summary { list-style:none; cursor:pointer; padding:14px 16px; border-radius:14px; background:var(--surface);
                          border:1px solid var(--line); font-size:14px; font-weight:600; display:flex; align-items:center; gap:9px; }
```
to:
```css
details.full > summary { list-style:none; cursor:pointer; padding:14px 0; background:var(--surface);
                          border-top:1px solid var(--line); border-bottom:1px solid var(--line); font-size:14px; font-weight:600; display:flex; align-items:center; gap:9px; }
```

Change:
```css
.wire > summary { font-size:14px; font-weight:700; padding:13px 15px; border-radius:14px; background:var(--surface);
                  border:1px solid var(--line); cursor:pointer; }
```
to:
```css
.wire > summary { font-size:14px; font-weight:700; padding:13px 0; background:var(--surface);
                  border-top:1px solid var(--line); border-bottom:1px solid var(--line); cursor:pointer; }
```

- [ ] **Step 4: Leave already-flat rows alone**

Do not modify `.brow`, `.wrow`, `.trow`, `.trendlist li`, `.efact`, or
`.odetail`/`.oflow-wrap`/`.otimeline` -- these already use
`border-bottom:1px solid var(--line-soft)` and will pick up the new
newspaper colors automatically from Task 1's token change with zero
further edits. `.odetail`'s own rounded-card look
(`background:var(--surface); border:1px solid var(--line); border-radius:16px;`
at `styles.css:241-242`) is a deliberate exception per the spec (the
Obsidian detail panel keeps its card framing) -- do not flatten it in
this task.

- [ ] **Step 5: Build and visually verify**

```bash
cd webapp && npm run build
```

Serve and open `app/`. Check every tab (Home, Markets, Words, Obsidian,
Trending) and confirm: no rounded corners or drop shadows remain anywhere
except `.odetail` (Obsidian's detail panel, left as-is per Step 4) and
`.pill`/`.tabbar` (not touched by this task -- tab bar styling is Task 2's
territory and was already converted to underlined/flat in that task).
Cards read as newspaper columns divided by hairline or double rules, not
boxes.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/styles.css
git commit -m "feat: flatten rounded surface cards to hairline dividers"
```

---

## Task 4: Page-flip transition between tabs

**Files:**
- Modify: `webapp/src/App.jsx` (the `switchTab` function and the `<main>` render block)
- Modify: `webapp/src/styles.css` (new `.pageflip` rules)

**Interfaces:**
- Consumes: the existing `tab` state and `switchTab` function in `App.jsx`.
- Produces: no new exports -- this is the last behavioral task, contained
  entirely inside `App.jsx` and its CSS.

- [ ] **Step 1: Add flip state to `App.jsx`**

Near the top of the `App` function, alongside the existing `const [tab, setTab] = useState('home')`,
add:

```jsx
const [flipping, setFlipping] = useState(null) // the tab being flipped away, or null
const [nextTab, setNextTab] = useState(null)   // the tab flipping in underneath
```

- [ ] **Step 2: Replace `switchTab` with the flip-aware version**

Replace the existing `switchTab` function:

```jsx
function switchTab(t) {
  setTab(t)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

with:

```jsx
function switchTab(t) {
  if (t === tab || flipping) return
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) {
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'auto' })
    return
  }
  setFlipping(tab)
  setNextTab(t)
  window.scrollTo({ top: 0, behavior: 'auto' })
  setTimeout(() => {
    setTab(t)
    setFlipping(null)
    setNextTab(null)
  }, 640)
}
```

The `if (t === tab || flipping) return` guard is what satisfies this
plan's Review Focus item on rapid repeated clicks: a second click during
an in-flight flip is a no-op until the first flip's `setTimeout` clears
`flipping`.

- [ ] **Step 3: Render both pages during a flip**

Find the `<main className="wrap">` block. It currently renders tab
content once, keyed off `tab`. Wrap it so that during a flip, both the
outgoing (`flipping`) and incoming (`nextTab`) content render
simultaneously, each in their own positioned layer. Extract the existing
big ternary into a small helper first -- add this function above the
`return` statement, right after `openArticleObj`:

```jsx
function renderTab(t) {
  if (error) return <div className="empty">Could not load.<br />{error}</div>
  if (!digest) return <div className="empty">Loading…</div>
  if (t === 'home') {
    return (
      <>
        {cat === 'All' && <ImportantSection items={important} data={data} onOpen={(a) => openArticle(a.url)} />}
        <CardFeed data={data} briefs={briefs} wire={wire} region={region} cat={cat} onOpen={(a) => openArticle(a.url)} />
      </>
    )
  }
  if (t === 'markets') return <MarketsBelt mkt={mkt} market={market} stamp={mktStamp} />
  if (t === 'obsidian') return <ObsidianGraph graph={graph} />
  if (t === 'trending') return <TrendingSection trending={trending} />
  return <GlossaryNebula data={data} />
}
```

Then replace the `<main className="wrap">...</main>` block with:

```jsx
<main className="wrap pageflip-stage">
  {flipping ? (
    <>
      <div className="pageflip-page pageflip-turning">{renderTab(flipping)}</div>
      <div className="pageflip-page pageflip-under">{renderTab(nextTab)}</div>
    </>
  ) : (
    <div className="pageflip-page">{renderTab(tab)}</div>
  )}
</main>
```

- [ ] **Step 4: Add the page-flip CSS**

In `webapp/src/styles.css`, add this new section right before the
`/* ---------- bottom nav ---------- */` section:

```css
/* ---------- page flip ---------- */
.pageflip-stage { position:relative; perspective:1800px; }
.pageflip-page { position:relative; background:var(--bg); }
.pageflip-stage:has(.pageflip-turning) .pageflip-page { position:absolute; inset:0; overflow-y:auto; max-height:100vh; }
.pageflip-turning { transform-origin:left center; backface-visibility:hidden;
                     animation:pageturn .64s cubic-bezier(.4,.1,.2,1) forwards; z-index:2; }
.pageflip-under { z-index:1; }
@keyframes pageturn { from { transform:rotateY(0deg); } to { transform:rotateY(-155deg); } }
@media (prefers-reduced-motion: reduce) {
  .pageflip-turning { animation:none; display:none; }
}
```

The existing global rule at `styles.css:364`
(`@media (prefers-reduced-motion: reduce) { * { animation-duration:.001ms !important; ... } }`)
already collapses this animation's duration near-instantly as a second
layer of protection, but `switchTab`'s own `prefersReduced` check in Step
2 is the primary guard -- it skips the flip entirely rather than relying
only on the CSS media query.

- [ ] **Step 5: Build and visually verify**

```bash
cd webapp && npm run build
```

Serve and open `app/`. Click each of the five tab-bar buttons and confirm
the current tab's content turns away on a left-edge hinge to reveal the
next tab's content underneath, settling within about two-thirds of a
second. Click a tab, then immediately click a different tab before the
first flip finishes -- confirm nothing breaks (the second click is
ignored until the first flip completes, per the guard in Step 2).

Then, in DevTools, enable "Emulate CSS prefers-reduced-motion: reduce"
(Rendering tab) and reload. Click tabs again and confirm the switch is
now instant with no rotation at all.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/App.jsx webapp/src/styles.css
git commit -m "feat: page-flip transition between tabs"
```

---

## Task 5: Full visual verification pass

**Files:**
- None modified -- this task is verification-only, using Playwright
  against the built `app/` the same way this project verified the
  Obsidian timeline redesign and the metals/crypto/forex section earlier
  this project.

**Interfaces:**
- Consumes: the finished app from Tasks 1-4. Produces nothing further --
  this is the plan's terminal task.

- [ ] **Step 1: Build and serve**

```bash
cd webapp && npm run build
cd ../app && python -m http.server 8899
```

- [ ] **Step 2: Verify headline images render in full color**

Using Playwright (`mcp__playwright__browser_navigate` to
`http://localhost:8899/index.html`, then `browser_take_screenshot`),
confirm the Home tab's lead story and rail cards show real photos with no
grayscale/sepia CSS filter applied anywhere in `styles.css` (grep for
`filter:` across the stylesheet -- there should be none introduced by
this plan). If the current edition's articles all have empty
`image_url` (per this plan's Global Constraints, the JSON data isn't
touched), confirm instead that the layout has no broken-image gap where a
photo would go -- this satisfies the Review Focus item on missing images.

- [ ] **Step 3: Verify Obsidian graph exemption**

Click the Obsidian tab (through the page-flip). Confirm the graph canvas
(`.ograph-scroll`) is still pure black (`#000`) with its original colored
nodes and edges, unaffected by the Day/Night Edition toggle -- toggle the
theme and confirm the graph's own colors do not change while the
surrounding page (the `.odetail` panel below it) does follow the new
newspaper palette.

- [ ] **Step 4: Verify both theme states end-to-end**

In Day Edition (default), screenshot the Home, Markets, and Obsidian
tabs. Toggle to Night Edition via the masthead's "Night Edition" link and
screenshot the same three tabs. Confirm text remains readable (dark ink
on light paper in Day Edition, light ink on dark background in Night
Edition) in both states, and that the double-rule masthead and hairline
dividers are visible in both.

- [ ] **Step 5: Verify wide-screen breakpoints**

Using `mcp__playwright__browser_resize` to set the viewport to 900px and
then 1300px wide, screenshot the Home tab at each width. Confirm the
masthead, hero, and rail layouts (governed by the existing `@media
(min-width: 760px)` and `@media (min-width: 1180px)` breakpoints at
`styles.css:307` and `:328`, unmodified by this plan) still look correct
with the new newspaper styling applied inside them.

- [ ] **Step 6: Run the existing Python test suite as a final sanity check**

```bash
cd .. && python -m pytest -q
```

Expected: all tests pass, unchanged count from before this plan started
-- this plan touches no Python code, so this step exists only to confirm
nothing was accidentally broken elsewhere in the repo during the frontend
work.

- [ ] **Step 7: Stop the test server and report**

```bash
# stop the python -m http.server process started in Step 1
```

No commit for this task -- it produced no code changes, only
verification. If any check in Steps 2-6 fails, return to the task whose
territory it falls under (Task 3 for card-flattening regressions, Task 4
for flip issues, Task 1 for theme-token issues) and fix it there with its
own commit, then re-run this task's checks from Step 1.
