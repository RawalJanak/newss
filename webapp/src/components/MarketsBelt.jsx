function pct(v) {
  return <span className={v >= 0 ? 'up' : 'dn'}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>
}
function n2(v) {
  return typeof v === 'number' && v >= 1000 ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(v)
}
function MTable({ title, items, sub }) {
  if (!items || !items.length) return null
  return (
    <div className="tbl">
      <h3>{title}</h3>
      {items.map((r, i) => (
        <div className="trow" key={i}>
          <div className="a"><div className="s">{r.name || r.symbol}</div><div className="u">{sub && r.sector ? r.sector : r.symbol}</div></div>
          <div className="b"><div className="pr">{n2(r.price)}</div><div className="ch">{pct(r.change_pct)}</div></div>
        </div>
      ))}
    </div>
  )
}

export default function MarketsBelt({ mkt, market, stamp }) {
  if (!mkt) return <div className="empty">Loading market data…</div>
  const m = mkt.markets[market]
  if (!m) return <div className="empty">No data.</div>
  const b = m.breadth || { up: 0, down: 0, total: 0 }
  const tot = Math.max(1, b.up + b.down)
  const ins = m.insight || { headline: '', body: '' }
  const sect = m.sectors && m.sectors.length
    ? [m.sectors[0], m.sectors[m.sectors.length - 1]].map((s) => ({
        name: s.sector, symbol: s.n + (s.n === 1 ? ' stock' : ' stocks'), price: '', change_pct: s.avg,
      }))
    : []

  return (
    <div className="page">
      <div className="idxgrid">
        {(m.indices || []).map((i, k) => (
          <div className="icard" key={k}><div className="n">{i.symbol}</div><div className="p">{n2(i.price)}</div><div className="c">{pct(i.change_pct)}</div></div>
        ))}
      </div>
      <div className="read">
        <h3>{ins.headline}</h3>
        <p>{ins.body}</p>
        <div className="bwrap">
          <span>{b.up} up · {b.down} down of {b.total}</span>
          <span className="bar2">
            <i className="g" style={{ width: (b.up / tot) * 100 + '%' }} />
            <i className="r" style={{ width: (b.down / tot) * 100 + '%' }} />
          </span>
        </div>
      </div>
      <MTable title="Sectors — best and worst" items={sect} sub={false} />
      <MTable title="Top gainers" items={m.gainers} sub />
      <MTable title="Top losers" items={m.losers} sub />
      <MTable title="Most traded" items={m.actives} sub />
      <MTable title="Recently listed" items={m.recent} sub />
      <div className="note">Snapshot taken {stamp}, not a live feed — prices update when the digest is rebuilt. India and China lists come from a large-cap universe; US lists are market-wide. Data via Yahoo Finance. Not investment advice.</div>
    </div>
  )
}
