import { examLevel } from '../lib.js'

export default function ImportantSection({ items, data, onOpen }) {
  if (!items || !items.length) return null

  function handleClick(e, it) {
    if (it.kind !== 'article') return
    const article = data.find((a) => a.url === it.url)
    if (!article) return
    e.preventDefault()
    onOpen(article)
  }

  return (
    <>
      <div className="shead"><h2>Important</h2><span className="seeall">{items.length} items</span></div>
      {items.map((it, i) => {
        const lvl = examLevel(it)
        const hasOwnReader = it.kind === 'article' && data.some((a) => a.url === it.url)
        return (
          <a
            className="impcard" key={i} href={it.url} target={hasOwnReader ? undefined : '_blank'}
            rel="noopener noreferrer" onClick={(e) => handleClick(e, it)}
          >
            <div className="idate">{(it.date || '').slice(5, 10)}</div>
            <div className="itxt">
              <div className="itagrow">
                <span className="cat">{it.category}</span>
                {(it.importance === 'high' || it.top_story) && <span className="tag must">Top</span>}
                {lvl && <span className={'examtag ' + lvl}>AAI</span>}
              </div>
              <h4>{it.title}</h4>
              {it.text && <p>{it.text}</p>}
              <div className="isrc">{it.source}{hasOwnReader ? ' · full coverage' : ''}</div>
            </div>
          </a>
        )
      })}
    </>
  )
}
