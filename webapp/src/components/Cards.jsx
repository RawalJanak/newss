import Hero3D from '../Hero3D.jsx'
import { ago, tierTag, hl, escapeHtml } from '../lib.js'

function Tags({ a }) {
  const t = tierTag(a)
  return (
    <>
      {t.must && <span className="tag must">Must read</span>}
      <span className={'tag ' + t.cls}>{t.label}</span>
    </>
  )
}

export function HeroCard({ a, onOpen }) {
  return (
    <button className="hero" onClick={onOpen}>
      <Hero3D />
      {a.image_url && <img src={a.image_url} alt="" onError={(e) => (e.target.style.display = 'none')} />}
      <span className="scrim" />
      <span className="cap">
        <span className="tagrow">
          <span className="cat">{a.category}</span>
          <Tags a={a} />
        </span>
        <h3>{a.title}</h3>
        <p>{a.summary}</p>
        <div className="meta">{a.source} · {ago(a.published)} · {a.read_min} min</div>
      </span>
    </button>
  )
}

export function RailCard({ a, onOpen }) {
  return (
    <button className="rcard" onClick={onOpen}>
      {a.image_url && <img src={a.image_url} alt="" loading="lazy" onError={(e) => (e.target.style.display = 'none')} />}
      <span className="pad">
        <span className="tagrow"><span className="cat">{a.category}</span></span>
        <h4>{a.title}</h4>
        <div className="meta">{ago(a.published)} · {a.read_min} min</div>
      </span>
    </button>
  )
}

export function ListCard({ a, onOpen }) {
  return (
    <button className={'lcard' + (a.importance === 'high' ? ' hot' : '')} onClick={onOpen}>
      <span className="txt">
        <span className="tagrow">
          <span className="cat">{a.category}</span>
          <Tags a={a} />
        </span>
        <h4>{a.title}</h4>
        <p>{a.summary}</p>
        <div className="meta">{a.source} · {ago(a.published)} · {a.read_min} min</div>
      </span>
      {a.image_url && <img src={a.image_url} alt="" loading="lazy" onError={(e) => (e.target.style.display = 'none')} />}
    </button>
  )
}

export function BriefList({ briefs, cat }) {
  const items = cat === 'All' ? briefs : briefs.filter((b) => b.category === cat)
  if (!items.length) return null
  return (
    <>
      <div className="shead"><h2>In brief</h2><span className="seeall">{items.length} items</span></div>
      {items.map((b, i) => (
        <div className="brow" key={i}>
          <div className="bdate">{(b.date || '').slice(5)}</div>
          <div className="btxt">
            <span className="bcat">
              {b.category}
              {b.exam && b.exam.relevance === 'high' && <span className="bexam">exam</span>}
            </span>
            <span dangerouslySetInnerHTML={{ __html: hl(escapeHtml(b.text)) }} />
          </div>
        </div>
      ))}
    </>
  )
}

export function WireList({ wire, cat }) {
  const items = cat === 'All' ? wire : wire.filter((w) => w.category === cat)
  if (!items.length) return null
  return (
    <details className="wire">
      <summary>{items.length} more stories today</summary>
      <div className="wirelist">
        {items.map((w, i) => (
          <a className="wrow" key={i} href={w.url} target="_blank" rel="noopener noreferrer">
            <span className="wcat">{w.category}</span>
            <span className="wt">{w.title}</span>
            <span className="wsrc">{w.source}</span>
          </a>
        ))}
      </div>
    </details>
  )
}
