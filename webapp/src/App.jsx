import { useEffect, useMemo, useState } from 'react'
import CardFeed from './components/CardFeed.jsx'
import ReaderPanel from './components/ReaderPanel.jsx'
import MarketsBelt from './components/MarketsBelt.jsx'
import GlossaryNebula from './components/GlossaryNebula.jsx'
import { CATEGORY_ORDER } from './lib.js'

const MARKET_OPTIONS = [['india', '🇮🇳 India'], ['usa', '🇺🇸 USA'], ['china', '🇨🇳 China'], ['global', '🌍 Global']]

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
  const [openUrl, setOpenUrl] = useState(null)

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
    else document.documentElement.removeAttribute('data-theme')
    try { if (theme) localStorage.setItem('mynews-theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    fetch('articles.json?t=' + Date.now()).then((r) => r.json()).then(setDigest).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (tab !== 'markets' || mkt) return
    fetch('markets.json?t=' + Date.now()).then((r) => r.json()).then(setMkt).catch((e) => setError(e.message))
  }, [tab, mkt])

  // Article deep-link: keeps the hash in sync so the browser Back button
  // closes the reader — the phone's native dismiss gesture.
  function openArticle(url) {
    setOpenUrl(url)
    const hash = '#a' + encodeURIComponent(url)
    if (location.hash !== hash) location.hash = hash
  }
  function closeArticle() {
    setOpenUrl(null)
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
  }
  useEffect(() => {
    function onHashChange() { if (!location.hash) setOpenUrl(null) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const data = digest?.articles || []
  const briefs = digest?.briefs || []
  const wire = digest?.wire || []

  const categories = useMemo(() => {
    const pool = data.filter((a) => region === 'all' || a.region === region)
    const have = new Set(pool.map((a) => a.category))
    return CATEGORY_ORDER.filter((k) => have.has(k))
  }, [data, region])

  useEffect(() => {
    if (cat !== 'All' && categories.indexOf(cat) === -1) setCat('All')
  }, [categories, cat])

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
  function pick(fn) {
    fn()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openArticleObj = data.find((a) => a.url === openUrl) || null

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
                <button key={r} className={'pill' + (region === r ? ' on' : '')} onClick={() => pick(() => setRegion(r))}>
                  {r === 'all' ? 'All news' : r === 'india' ? '🇮🇳 India' : '🌍 Global'}
                </button>
              ))}
              <button className={'pill' + (cat === 'All' ? ' on' : '')} onClick={() => pick(() => setCat('All'))}>Everything</button>
              {categories.map((k) => (
                <button key={k} className={'pill' + (cat === k ? ' on' : '')} onClick={() => pick(() => setCat(k))}>{k}</button>
              ))}
            </>
          )}
          {tab === 'markets' && MARKET_OPTIONS.map(([id, label]) => (
            <button key={id} className={'pill' + (market === id ? ' on' : '')} onClick={() => pick(() => setMarket(id))}>{label}</button>
          ))}
        </div>
      </div>

      <main className="wrap">
        {error ? (
          <div className="empty">Could not load.<br />{error}</div>
        ) : !digest ? (
          <div className="empty">Loading…</div>
        ) : tab === 'home' ? (
          <CardFeed data={data} briefs={briefs} wire={wire} region={region} cat={cat} onOpen={(a) => openArticle(a.url)} />
        ) : tab === 'markets' ? (
          <MarketsBelt mkt={mkt} market={market} stamp={mktStamp} />
        ) : (
          <GlossaryNebula data={data} />
        )}
      </main>

      <ReaderPanel article={openArticleObj} onClose={closeArticle} />

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
