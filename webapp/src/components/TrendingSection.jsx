const PLATFORM_CLASS = {
  'X (Twitter)': 'tw',
  'Reddit': 'rd',
  'Google Trends': 'gt',
}

export default function TrendingSection({ trending }) {
  if (!trending) return <div className="empty">Loading…</div>
  const items = trending.items || []
  if (!items.length) return <div className="empty">No trending data yet.</div>

  return (
    <div className="trend-wrap">
      <div className="shead"><h2>Trending</h2><span className="seeall">Top {items.length}</span></div>
      <p className="trend-note">
        Real platform trending mechanisms only — Google Trends, Reddit r/popular, X/Twitter's own
        Trending panel. Nothing here is approximated from search or engagement counting.
      </p>
      <ol className="trendlist">
        {items.map((it) => (
          <li key={it.rank}>
            <span className="trend-rank">{it.rank}</span>
            <div className="trend-body">
              <span className={'trend-platform ' + (PLATFORM_CLASS[it.platform] || '')}>{it.platform}</span>
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="trend-topic">{it.topic}</a>
              {it.meta && <div className="trend-meta">{it.meta}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
