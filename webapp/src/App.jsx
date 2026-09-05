import { useEffect, useMemo, useRef, useState } from 'react'
import Starfield from './three/Starfield.jsx'
import ReaderPanel from './components/ReaderPanel.jsx'
import CategoryDock from './components/CategoryDock.jsx'
import RegionSwitcher from './components/RegionSwitcher.jsx'
import MarketsBelt from './components/MarketsBelt.jsx'
import GlossaryNebula from './components/GlossaryNebula.jsx'
import MobileList from './components/MobileList.jsx'
import OnboardingHint from './components/OnboardingHint.jsx'
import { useRenderTier } from './device.js'
import { decayStrength } from './gravity/gravityPull.js'
import { CATEGORY_ORDER } from './lib.js'

function readReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const MARKET_OPTIONS = [['india', '🇮🇳 India'], ['usa', '🇺🇸 USA'], ['china', '🇨🇳 China'], ['global', '🌍 Global']]
function MarketPills({ market, onSelect }) {
  return (
    <div className="mobile-chip-row">
      {MARKET_OPTIONS.map(([id, label]) => (
        <button key={id} className={'mobile-chip' + (market === id ? ' on' : '')} onClick={() => onSelect(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const tier = useRenderTier() // 'full' | 'reduced' | 'mobile'
  const reducedMotion = tier === 'reduced' || readReducedMotion()

  const [digest, setDigest] = useState(null)
  const [mkt, setMkt] = useState(null)
  const [error, setError] = useState(null)
  const [region, setRegion] = useState('news')
  const [market, setMarket] = useState('india')
  const [activeCategory, setActiveCategory] = useState(null)
  const [pullStrength, setPullStrength] = useState(0)
  const [openUrl, setOpenUrl] = useState(null)
  const decayRef = useRef(null)
  // Mirrors pullStrength synchronously so handleRelease reads the live value
  // instead of a stale render closure — matters when onDragCategory and
  // onRelease fire back-to-back in the same event handler (click/keyboard
  // activation), which React batches into a single commit.
  const pullRef = useRef(0)

  // Article deep-link: keep the hash in sync with the open article so the
  // browser Back button (mobile's native dismiss gesture) closes the reader.
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
    function onHashChange() {
      if (!location.hash) setOpenUrl(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    fetch('articles.json?t=' + Date.now()).then((r) => r.json()).then(setDigest).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (region !== 'markets' || mkt) return
    fetch('markets.json?t=' + Date.now()).then((r) => r.json()).then(setMkt).catch((e) => setError(e.message))
  }, [region, mkt])

  const data = digest?.articles || []
  const briefs = digest?.briefs || []
  const wire = digest?.wire || []

  const categories = useMemo(() => {
    const have = new Set(data.map((a) => a.category))
    return CATEGORY_ORDER.filter((k) => have.has(k))
  }, [data])

  // Gravity-drag: dragging sets strength to 1 immediately; releasing starts
  // an exponential decay back to 0 each animation frame (spec §4.3).
  function handleDragCategory(category) {
    setActiveCategory(category)
    setPullStrength(1)
    pullRef.current = 1
    if (decayRef.current) cancelAnimationFrame(decayRef.current)
  }
  function handleRelease() {
    if (decayRef.current) cancelAnimationFrame(decayRef.current)
    let last = performance.now()
    let strength = pullRef.current
    function tick(now) {
      const dt = (now - last) / 1000
      last = now
      strength = decayStrength(strength, dt)
      pullRef.current = strength
      if (strength < 0.02) {
        pullRef.current = 0
        setPullStrength(0)
        setActiveCategory(null)
        decayRef.current = null
        return
      }
      setPullStrength(strength)
      decayRef.current = requestAnimationFrame(tick)
    }
    decayRef.current = requestAnimationFrame(tick)
  }

  const openArticleObj = data.find((a) => a.url === openUrl) || null

  if (error) return <div className="empty">Could not load.<br />{error}</div>
  if (!digest) return <div className="empty">Loading…</div>

  if (tier === 'mobile') {
    return (
      <>
        <RegionSwitcher region={region} onSwitch={setRegion} />
        {region === 'news' && (
          <MobileList
            articles={data} briefs={briefs} categories={categories}
            activeCategory={activeCategory} onSelectCategory={setActiveCategory}
            onOpenArticle={openArticle}
          />
        )}
        {region === 'markets' && (
          <>
            <MarketPills market={market} onSelect={setMarket} />
            <MarketsBelt mkt={mkt} market={market} stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} />
          </>
        )}
        {region === 'glossary' && <GlossaryNebula data={data} />}
        <ReaderPanel article={openArticleObj} onClose={closeArticle} reducedMotion />
        <OnboardingHint />
      </>
    )
  }

  return (
    <>
      {region === 'news' && (
        <Starfield
          articles={data} briefs={briefs} wire={wire}
          activeCategory={activeCategory} pullStrength={pullStrength}
          onOpenArticle={openArticle} openArticleUrl={openUrl} reducedMotion={reducedMotion}
        />
      )}
      {region === 'markets' && <div className="chrome"><MarketsBelt mkt={mkt} market={market} stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} /></div>}
      {region === 'glossary' && <div className="chrome"><GlossaryNebula data={data} /></div>}
      <div className="chrome">
        <RegionSwitcher region={region} onSwitch={setRegion} />
        {region === 'news' && (
          <CategoryDock categories={categories} active={activeCategory} onDragCategory={handleDragCategory} onRelease={handleRelease} />
        )}
        {region === 'markets' && (
          <div className="market-pills-dock"><MarketPills market={market} onSelect={setMarket} /></div>
        )}
      </div>
      <ReaderPanel article={openArticleObj} onClose={closeArticle} reducedMotion={reducedMotion} />
      <OnboardingHint />
    </>
  )
}
