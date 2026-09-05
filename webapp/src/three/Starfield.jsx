import { useEffect, useMemo, useReducer } from 'react'
import { Canvas } from '@react-three/fiber'
import Star from './Star.jsx'
import Dust from './Dust.jsx'
import CameraRig from '../camera/CameraRig.jsx'
import { cameraReducer, INITIAL_CAMERA_STATE } from '../camera/cameraMachine.js'
import { pullFactor } from '../gravity/gravityPull.js'
import { PALETTE } from '../theme.js'

// Deterministic golden-angle spiral so star positions are stable across
// re-renders (no data-driven randomness — same articles always land in
// the same spots for a given index).
function sphereLayout(index, total, radius = 4.5) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const y = 1 - (index / Math.max(1, total - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = golden * index
  return [Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius]
}

export default function Starfield({ articles, briefs, wire, activeCategory, pullStrength, onOpenArticle, openArticleUrl, reducedMotion }) {
  const [camState, dispatch] = useReducer(cameraReducer, INITIAL_CAMERA_STATE)

  useEffect(() => {
    if (openArticleUrl == null && camState.mode !== 'idle') {
      dispatch({ type: 'CLOSE_READER' })
    }
  }, [openArticleUrl])

  const starPositions = useMemo(
    () => articles.map((_, i) => sphereLayout(i, articles.length)),
    [articles]
  )

  const briefDust = useMemo(
    () => briefs.map((_, i) => ({ position: sphereLayout(i, briefs.length, 6) })),
    [briefs]
  )
  const wireDust = useMemo(
    () => wire.map((_, i) => ({ position: sphereLayout(i, wire.length, 8) })),
    [wire]
  )

  const focusedIndex = articles.findIndex((a) => a.url === camState.targetId)
  const targetPosition = focusedIndex >= 0 ? starPositions[focusedIndex] : null

  function handleFocus(url) {
    dispatch({ type: 'FOCUS', id: url })
    onOpenArticle(url)
  }

  return (
    <Canvas className="constellation-canvas" camera={{ position: [0, 0, 8], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color={PALETTE.violet} />
      <CameraRig state={camState} targetPosition={targetPosition} reducedMotion={reducedMotion} />
      {/* wire is the dimmest tier, briefs brighter — spec §4.2 tiering */}
      <Dust items={wireDust} color={PALETTE.faint} opacity={0.15} reducedMotion={reducedMotion} />
      <Dust items={briefDust} color={PALETTE.muted} opacity={0.3} reducedMotion={reducedMotion} />
      {articles.map((article, i) => (
        <Star
          key={article.url}
          article={article}
          position={starPositions[i]}
          pull={pullFactor({ itemCategory: article.category, activeCategory, strength: pullStrength })}
          onFocus={handleFocus}
          reducedMotion={reducedMotion}
        />
      ))}
    </Canvas>
  )
}
