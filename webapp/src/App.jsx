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

export default function App() {
  const tier = useRenderTier() // 'full' | 'reduced' | 'mobile'
  const reducedMotion = tier === 'reduced' || readReducedMotion()

  const [digest, setDigest] = useState(null)
  const [mkt, setMkt] = useState(null)
  const [error, setError] = useState(null)
  const [region, setRegion] = useState('news')
  const [activeCategory, setActiveCategory] = useState(null)
  const [pullStrength, setPullStrength] = useState(0)
  const [openUrl, setOpenUrl] = useState(null)
  const decayRef = useRef(null)

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
    if (decayRef.current) cancelAnimationFrame(decayRef.current)
  }
  function handleRelease() {
    let last = performance.now()
    function tick(now) {
      const dt = (now - last) / 1000
      last = now
      setPullStrength((s) => {
        const next = decayStrength(s, dt)
        if (next < 0.02) {
          setActiveCategory(null)
          return 0
        }
        decayRef.current = requestAnimationFrame(tick)
        return next
      })
    }
    decayRef.current = requestAnimationFrame(tick)
  }

  const openArticle = data.find((a) => a.url === openUrl) || null

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
            onOpenArticle={setOpenUrl}
          />
        )}
        {region === 'markets' && <MarketsBelt mkt={mkt} market="india" stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} />}
        {region === 'glossary' && <GlossaryNebula data={data} />}
        <ReaderPanel article={openArticle} onClose={() => setOpenUrl(null)} reducedMotion />
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
          onOpenArticle={setOpenUrl} reducedMotion={reducedMotion}
        />
      )}
      {region === 'markets' && <div className="chrome"><MarketsBelt mkt={mkt} market="india" stamp={mkt ? new Date(mkt.generated_at).toLocaleString('en-IN') : ''} /></div>}
      {region === 'glossary' && <div className="chrome"><GlossaryNebula data={data} /></div>}
      <div className="chrome">
        <RegionSwitcher region={region} onSwitch={setRegion} />
        {region === 'news' && (
          <CategoryDock categories={categories} active={activeCategory} onDragCategory={handleDragCategory} onRelease={handleRelease} />
        )}
      </div>
      <ReaderPanel article={openArticle} onClose={() => setOpenUrl(null)} reducedMotion={reducedMotion} />
      <OnboardingHint />
    </>
  )
}
