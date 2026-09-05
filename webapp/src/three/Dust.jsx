import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Renders an entire tier (briefs or wire) as ONE Points object — this is
// the load-bearing perf decision from spec §4.2: never one mesh per item.
export default function Dust({ items, color, opacity = 0.35 }) {
  const ref = useRef()

  const positions = useMemo(() => {
    const arr = new Float32Array(items.length * 3)
    items.forEach((item, i) => {
      arr[i * 3] = item.position[0]
      arr[i * 3 + 1] = item.position[1]
      arr[i * 3 + 2] = item.position[2]
    })
    return arr
  }, [items])

  useFrame((state) => {
    if (!ref.current) return
    // slow drift, dimmer/slower than stars per spec §3
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.01
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} transparent opacity={opacity} sizeAttenuation />
    </points>
  )
}
