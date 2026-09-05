import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { colorForCategory, sizeForArticle } from '../theme.js'

// One deep article rendered as a star mesh. Never used for briefs/wire —
// those go through Dust.jsx as instanced geometry (Global Constraint).
export default function Star({ article, position, pull = 1, onFocus, reducedMotion = false }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const baseScale = sizeForArticle(article) * pull
  const color = colorForCategory(article.category)

  useFrame((state) => {
    if (!ref.current) return
    const targetScale = hovered ? baseScale * 1.25 : baseScale

    if (reducedMotion) {
      // prefers-reduced-motion: no drift, no eased scale — snap instantly.
      ref.current.position.y = position[1]
      ref.current.scale.set(targetScale, targetScale, targetScale)
      return
    }

    const t = state.clock.getElapsedTime()
    // gentle idle drift, per spec §3 motion principles
    ref.current.position.y = position[1] + Math.sin(t * 0.4 + position[0]) * 0.08
    ref.current.scale.lerp({ x: targetScale, y: targetScale, z: targetScale }, 0.15)
  })

  return (
    <mesh
      ref={ref}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => onFocus(article.url)}
    >
      <sphereGeometry args={[0.4, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.9 : 0.4}
        roughness={0.3}
      />
    </mesh>
  )
}
