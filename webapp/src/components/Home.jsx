import { HeroCard, RailCard, ListCard, BriefList, WireList } from './Cards.jsx'

export default function Home({ data, briefs, wire, region, cat, onOpen }) {
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
