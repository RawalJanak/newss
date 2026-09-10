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

function HeroCard({ a, onOpen }) {
  return (
    <button className="hero" onClick={onOpen}>
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

function RailCard({ a, onOpen }) {
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

function ListCard({ a, onOpen }) {
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

function BriefList({ briefs, cat }) {
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

function WireList({ wire, cat }) {
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

// The whole home page: a hero, an "also important" rail, an everything-else
// grid, then briefs and wire. Every story is a plain visible card — no
// hover-to-reveal, no drag, nothing hidden.
export default function CardFeed({ data, briefs, wire, region, cat, onOpen }) {
  const list = data.filter((a) => {
    if (region !== 'all' && a.region !== region) return false
    if (cat !== 'All' && a.category !== cat) return false
    return true
  })

  if (!list.length && !briefs.length && !wire.length) {
    return <div className="empty">Nothing here yet.</div>
  }

  let lead = null, railItems = [], others = []
  if (list.length) {
    const must = list.filter((a) => a.importance === 'high')
    lead = must[0] || list[0]
    const rest = list.filter((a) => a !== lead)
    railItems = rest.filter((a) => a.top_story || a.importance === 'high').slice(0, 6)
    others = rest.filter((a) => railItems.indexOf(a) === -1)
  }

  return (
    <>
      {lead && (
        <>
          <div className="shead"><h2>Today's lead</h2></div>
          <HeroCard a={lead} onOpen={() => onOpen(lead)} />
        </>
      )}
      {railItems.length > 0 && (
        <>
          <div className="shead"><h2>Also important</h2><span className="seeall">{railItems.length} stories</span></div>
          <div className="rail">
            {railItems.map((a, i) => <RailCard a={a} key={i} onOpen={() => onOpen(a)} />)}
          </div>
        </>
      )}
      {others.length > 0 && (
        <>
          <div className="shead"><h2>{cat === 'All' ? 'Everything else' : cat}</h2></div>
          <div className="lgrid">
            {others.map((a, i) => <ListCard a={a} key={i} onOpen={() => onOpen(a)} />)}
          </div>
        </>
      )}
      <BriefList briefs={briefs} cat={cat} />
      <WireList wire={wire} cat={cat} />
    </>
  )
}
