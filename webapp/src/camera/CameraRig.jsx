import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Drives the Canvas camera off the pure cameraMachine state (Task 4).
// idle: stays at the default position. focused: dollies toward targetPosition.
// reader-open: holds still (spec §4.4 — "no 3D behind an open reader").
const DEFAULT_POSITION = new THREE.Vector3(0, 0, 8)

export default function CameraRig({ state, targetPosition, reducedMotion }) {
  const { camera } = useThree()
  const desired = useRef(DEFAULT_POSITION.clone())

  useFrame(() => {
    if (state.mode === 'focused' && targetPosition) {
      desired.current.set(targetPosition[0], targetPosition[1], targetPosition[2] + 2)
    } else if (state.mode === 'idle') {
      desired.current.copy(DEFAULT_POSITION)
    }
    // reader-open: leave desired wherever it was — camera holds still.
    if (reducedMotion) {
      camera.position.copy(desired.current)
    } else {
      camera.position.lerp(desired.current, 0.06)
    }
    camera.lookAt(0, 0, 0)
  })

  return null
}
