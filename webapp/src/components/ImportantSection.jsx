import { examLevel } from '../lib.js'

export default function ImportantSection({ items }) {
  if (!items || !items.length) return null
  return (
    <>
      <div className="shead"><h2>Important</h2><span className="seeall">{items.length} items</span></div>
      {items.map((it, i) => {
        const lvl = examLevel(it)
        return (
          <a className="impcard" key={i} href={it.url} target="_blank" rel="noopener noreferrer">
            <div className="idate">{(it.date || '').slice(5, 10)}</div>
            <div className="itxt">
              <div className="itagrow">
                <span className="cat">{it.category}</span>
                {(it.importance === 'high' || it.top_story) && <span className="tag must">Top</span>}
                {lvl && <span className={'examtag ' + lvl}>AAI</span>}
              </div>
              <h4>{it.title}</h4>
              <div className="isrc">{it.source}</div>
            </div>
          </a>
        )
      })}
    </>
  )
}
