import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float } from '@react-three/drei'
import * as THREE from 'three'

// Procedural Queen Chess Piece (no .glb needed)
function Queen({ ...props }) {
    const groupRef = useRef<THREE.Group>(null)

    // Rotate slowly
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.3
        }
    })

    // Metallic silver material
    const metalMaterial = (
        <meshStandardMaterial
            color="#B8B8B8"
            metalness={0.9}
            roughness={0.15}
            envMapIntensity={1.5}
        />
    )

    return (
        <group ref={groupRef} {...props}>
            {/* Base */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.8, 1, 0.2, 32]} />
                {metalMaterial}
            </mesh>

            {/* Lower ring */}
            <mesh position={[0, 0.2, 0]}>
                <cylinderGeometry args={[0.7, 0.8, 0.15, 32]} />
                {metalMaterial}
            </mesh>

            {/* Body taper */}
            <mesh position={[0, 0.9, 0]}>
                <cylinderGeometry args={[0.4, 0.7, 1.2, 32]} />
                {metalMaterial}
            </mesh>

            {/* Upper body */}
            <mesh position={[0, 1.8, 0]}>
                <cylinderGeometry args={[0.5, 0.4, 0.6, 32]} />
                {metalMaterial}
            </mesh>

            {/* Neck */}
            <mesh position={[0, 2.3, 0]}>
                <cylinderGeometry args={[0.35, 0.5, 0.4, 32]} />
                {metalMaterial}
            </mesh>

            {/* Crown base */}
            <mesh position={[0, 2.6, 0]}>
                <cylinderGeometry args={[0.55, 0.35, 0.2, 32]} />
                {metalMaterial}
            </mesh>

            {/* Crown points */}
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                const angle = (i / 8) * Math.PI * 2
                const x = Math.cos(angle) * 0.45
                const z = Math.sin(angle) * 0.45
                return (
                    <mesh key={i} position={[x, 2.95, z]}>
                        <sphereGeometry args={[0.12, 16, 16]} />
                        {metalMaterial}
                    </mesh>
                )
            })}

            {/* Top orb */}
            <mesh position={[0, 3.1, 0]}>
                <sphereGeometry args={[0.18, 32, 32]} />
                {metalMaterial}
            </mesh>
        </group>
    )
}

export default function Hero3D() {
    return (
        <div className="w-full h-[400px] lg:h-[500px]">
            <Canvas
                camera={{ position: [0, 2, 6], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.3} />
                <spotLight
                    position={[5, 10, 5]}
                    angle={0.3}
                    penumbra={1}
                    intensity={1.5}
                    castShadow
                />
                <spotLight
                    position={[-5, 5, -5]}
                    angle={0.3}
                    penumbra={1}
                    intensity={0.8}
                    color="#D4FF00"
                />

                {/* Environment for reflections */}
                <Environment preset="city" />

                {/* Floating animation wrapper */}
                <Float
                    speed={2}
                    rotationIntensity={0.3}
                    floatIntensity={0.5}
                >
                    <Queen position={[0, -1.5, 0]} scale={0.8} />
                </Float>
            </Canvas>
        </div>
    )
}
