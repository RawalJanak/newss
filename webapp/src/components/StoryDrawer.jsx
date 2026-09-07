import { useState } from 'react'

// Desktop's only path to briefs/wire — the starfield only renders the ~15
// deep articles as stars; briefs/wire render as unclickable background
// dust (spec §4.2). This drawer surfaces that content as a plain list,
// same content the old app's BriefList/WireList showed, filtered by the
// active category when one is set.
export default function StoryDrawer({ briefs, wire, activeCategory }) {
  const [open, setOpen] = useState(false)
  const visibleBriefs = activeCategory ? briefs.filter((b) => b.category === activeCategory) : briefs
  const visibleWire = activeCategory ? wire.filter((w) => w.category === activeCategory) : wire

  if (!open) {
    return (
      <button className="story-drawer-toggle" onClick={() => setOpen(true)}>
        More stories ({briefs.length + wire.length})
      </button>
    )
  }

  return (
    <aside className="story-drawer">
      <button className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
      <h2>More stories</h2>
      <div className="sub">{visibleBriefs.length} briefs · {visibleWire.length} wire{activeCategory ? ' · ' + activeCategory : ''}</div>

      {visibleBriefs.length > 0 && (
        <>
          <h3>In brief</h3>
          {visibleBriefs.map((b, i) => (
            <div className="brow" key={i}>
              <div className="bdate">{(b.date || '').slice(5)}</div>
              <div className="btxt">{b.text}</div>
            </div>
          ))}
        </>
      )}

      {visibleWire.length > 0 && (
        <>
          <h3>Wire</h3>
          {visibleWire.map((w, i) => (
            <a className="wrow" key={i} href={w.url} target="_blank" rel="noopener noreferrer">
              <span className="wt">{w.title}</span>
              <span className="wsrc">{w.source}</span>
            </a>
          ))}
        </>
      )}
    </aside>
  )
}
