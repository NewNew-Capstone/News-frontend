import { Environment } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

function LiquidMetalKnot() {
  const meshRef = useRef(null)

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()

    meshRef.current.rotation.x = -0.42 + Math.sin(elapsed * 0.32) * 0.08
    meshRef.current.rotation.y = elapsed * 0.18
    meshRef.current.rotation.z = 0.16 + Math.sin(elapsed * 0.24) * 0.08
    meshRef.current.position.y = Math.sin(elapsed * 0.72) * 0.16
  })

  return (
    <mesh ref={meshRef} scale={0.68}>
      <torusKnotGeometry args={[1.42, 0.32, 260, 42]} />
      <meshStandardMaterial
        color="#dff3ff"
        envMapIntensity={2.6}
        metalness={1}
        roughness={0.1}
      />
    </mesh>
  )
}

function HeroChromeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 6.6], fov: 34 }}
      className="home-section__hero-canvas"
      dpr={[1, 1.8]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
    >
      <ambientLight intensity={0.48} />
      <directionalLight color="#ffffff" intensity={1.7} position={[3.6, 4.2, 3.4]} />
      <pointLight color="#a2cded" intensity={12} position={[-3.2, -1.8, 2.6]} />
      <pointLight color="#639cd8" intensity={5} position={[2.4, -2.6, 3.2]} />
      <LiquidMetalKnot />
      <Environment preset="city" />
    </Canvas>
  )
}

export default HeroChromeScene
