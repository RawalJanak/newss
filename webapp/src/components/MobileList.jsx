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
