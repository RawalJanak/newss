import { useEffect, useMemo, useState } from 'react'
import Home from './components/Home.jsx'
import MarketsBelt from './components/MarketsBelt.jsx'
import GlossaryNebula from './components/GlossaryNebula.jsx'
import ReaderPanel from './components/ReaderPanel.jsx'
import { CATEGORY_ORDER } from './lib.js'

function readTheme() {
  try { return localStorage.getItem('mynews-theme') || null } catch { return null }
}

export default function App() {
  const [theme, setTheme] = useState(readTheme)
  const [tab, setTab] = useState('home')
  const [region, setRegion] = useState('all')
  const [cat, setCat] = useState('All')
  const [market, setMarket] = useState('india')

  const [digest, setDigest] = useState(null)
  const [mkt, setMkt] = useState(null)
  const [error, setError] = useState(null)
  const [openIdx, setOpenIdx] = useState(null)

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    try { if (theme) localStorage.setItem('mynews-theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    fetch('articles.json?t=' + Date.now())
      .then((r) => r.json())
      .then(setDigest)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (tab !== 'markets' || mkt) return
    fetch('markets.json?t=' + Date.now())
      .then((r) => r.json())
      .then(setMkt)
      .catch((e) => setError(e.message))
  }, [tab, mkt])

  // hash-based deep link into an article, mirrors the original single-file app
  useEffect(() => {
    if (!digest) return
    const m = /^#a(\d+)$/.exec(location.hash)
    if (m) setOpenIdx(+m[1])
    function onHash() {
      const mm = /^#a(\d+)$/.exec(location.hash)
      setOpenIdx(mm ? +mm[1] : null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [digest])

  const data = digest?.articles || []
  const briefs = digest?.briefs || []
  const wire = digest?.wire || []

  const cats = useMemo(() => {
    const pool = data.filter((a) => region === 'all' || a.region === region)
    const have = new Set(pool.map((a) => a.category))
    return CATEGORY_ORDER.filter((k) => have.has(k))
  }, [data, region])

  useEffect(() => {
    if (cat !== 'All' && cats.indexOf(cat) === -1) setCat('All')
  }, [cats, cat])

  const stamp = useMemo(() => {
    if (!digest) return 'loading'
    const w = new Date(digest.generated_at)
    const s = isNaN(w) ? '' : w.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    const ind = data.filter((a) => a.region === 'india').length
    return s + ' · ' + data.length + ' stories · ' + ind + ' India / ' + (data.length - ind) + ' global'
  }, [digest, data])

  const mktStamp = useMemo(() => {
    if (!mkt) return ''
    const w = new Date(mkt.generated_at)
    return isNaN(w) ? '' : w.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }, [mkt])

  function switchTab(t) {
    setTab(t)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function pickPill(fn) {
    fn()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openArticle(a) {
    const i = data.indexOf(a)
    setOpenIdx(i)
    if (location.hash !== '#a' + i) location.hash = '#a' + i
  }
  function closeArticle() {
    setOpenIdx(null)
    if (location.hash) history.replaceState(null, '', location.pathname)
  }

  const article = openIdx != null ? data[openIdx] : null

  return (
    <>
      <div className="bar">
        <div className="in">
          <div className="brand">My<em>News</em></div>
          <button className="round" aria-label="Switch theme" onClick={() => setTheme((t) => ((t || 'dark') === 'dark' ? 'light' : 'dark'))}>☾</button>
          <button className="round" aria-label="Refresh" onClick={() => location.reload()}>⟳</button>
        </div>
        <div className="stamp">{stamp}</div>
        <div className="pills">
          {tab === 'home' && (
            <>
              {['all', 'india', 'global'].map((r) => (
                <button key={r} className={'pill' + (region === r ? ' on' : '')} onClick={() => pickPill(() => setRegion(r))}>
                  {r === 'all' ? 'All news' : r === 'india' ? '🇮🇳 India' : '🌍 Global'}
                </button>
              ))}
              <button className={'pill' + (cat === 'All' ? ' on' : '')} onClick={() => pickPill(() => setCat('All'))}>Everything</button>
              {cats.map((k) => (
                <button key={k} className={'pill' + (cat === k ? ' on' : '')} onClick={() => pickPill(() => setCat(k))}>{k}</button>
              ))}
            </>
          )}
          {tab === 'markets' && (
            [['india', '🇮🇳 India'], ['usa', '🇺🇸 USA'], ['china', '🇨🇳 China'], ['global', '🌍 Global']].map(([id, label]) => (
              <button key={id} className={'pill' + (market === id ? ' on' : '')} onClick={() => pickPill(() => setMarket(id))}>{label}</button>
            ))
          )}
        </div>
      </div>

      <main className="wrap">
        {error ? (
          <div className="empty">Could not load.<br />{error}</div>
        ) : !digest ? (
          <div className="empty">Loading…</div>
        ) : tab === 'home' ? (
          <Home data={data} briefs={briefs} wire={wire} region={region} cat={cat} onOpen={openArticle} />
        ) : tab === 'markets' ? (
          <MarketsBelt mkt={mkt} market={market} stamp={mktStamp} />
        ) : (
          <GlossaryNebula data={data} />
        )}
      </main>

      <ReaderPanel article={article} onClose={closeArticle} />

      <nav className="tabbar">
        <div className="in">
          <button className={tab === 'home' ? 'on' : ''} onClick={() => switchTab('home')}>
            <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>Home
          </button>
          <button className={tab === 'markets' ? 'on' : ''} onClick={() => switchTab('markets')}>
            <svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 5-7 4 4" /><path d="M3 21h18" /></svg>Markets
          </button>
          <button className={tab === 'glossary' ? 'on' : ''} onClick={() => switchTab('glossary')}>
            <svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M9 8h7M9 12h7" /></svg>Words
          </button>
        </div>
      </nav>
    </>
  )
}
