import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sparkles } from '@react-three/drei'

// ponytail: no orbit controls / interaction — this is a decorative backdrop,
// not a 3D viewer. Pointer events pass through to the hero card underneath
// (see .hero3d { pointer-events:none } in styles.css).

function Blob({ accent }) {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    ref.current.rotation.x = t * 0.12
    ref.current.rotation.y = t * 0.18
    ref.current.position.y = Math.sin(t * 0.6) * 0.15
  })
  return (
    <mesh ref={ref} scale={1.7}>
      <icosahedronGeometry args={[1, 12]} />
      <MeshDistortMaterial
        color={accent}
        speed={1.6}
        distort={0.42}
        radius={1}
        roughness={0.25}
        metalness={0.1}
      />
    </mesh>
  )
}

function readAccent() {
  if (typeof window === 'undefined') return '#3FD98B'
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  return v || '#3FD98B'
}

// Renders a subtle animated glass-blob backdrop themed to the app's accent
// color. Skipped on phones (see Hero3D wrapper) and under
// prefers-reduced-motion — it's an accent, not a requirement to read the news.
export default function Hero3D() {
  const [accent, setAccent] = useState(readAccent)
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  useEffect(() => {
    // theme toggle flips a documentElement attribute; re-read the CSS var
    // whenever it changes rather than hardcoding both palettes here.
    const obs = new MutationObserver(() => setAccent(readAccent()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  if (reduceMotion) return null

  return (
    <div className="hero3d" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 4]} intensity={1.1} />
        <Blob accent={accent} />
        <Sparkles count={40} scale={4} size={2} speed={0.3} color={accent} opacity={0.5} />
      </Canvas>
    </div>
  )
}
