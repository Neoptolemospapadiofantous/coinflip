'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Physics, useCylinder } from '@react-three/cannon';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

interface CoinFlip3DProps {
  isFlipping: boolean;
  result?: boolean; // false = heads, true = tails
  onFlipComplete?: () => void;
  autoFlip?: boolean;
}

function Coin({ isFlipping, result, onFlipComplete }: CoinFlip3DProps) {
  const [_ref, api] = useCylinder(() => ({
    mass: 1,
    args: [1, 1, 0.2, 32],
    position: [0, 5, 0],
  }));

  const meshRef = useRef<THREE.Mesh>(null);
  const [hasLanded, setHasLanded] = useState(false);

  useEffect(() => {
    if (isFlipping && !hasLanded) {
      // Apply initial force for flip
      api.velocity.set(0, 8, 0);
      api.angularVelocity.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      );
    }
  }, [isFlipping, api, hasLanded]);

  useFrame(() => {
    if (meshRef.current && isFlipping && !hasLanded) {
      const position = meshRef.current.position.y;

      // Check if coin has landed
      if (position < 0.2 && position > -0.2) {
        setHasLanded(true);

        // Orient coin to show result
        const targetRotation = result ? Math.PI : 0;
        meshRef.current.rotation.x = targetRotation;

        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);

        if (onFlipComplete) {
          setTimeout(() => onFlipComplete(), 500);
        }
      }
    }
  });

  return (
    <mesh ref={meshRef as React.RefObject<THREE.Mesh>} castShadow receiveShadow>
      <cylinderGeometry args={[1, 1, 0.2, 32]} />
      <meshStandardMaterial
        color="#facc15"
        metalness={0.8}
        roughness={0.2}
      >
        {/* Coin texture could be added here */}
      </meshStandardMaterial>
    </mesh>
  );
}

function Ground() {
  return (
    <mesh receiveShadow position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <shadowMaterial opacity={0.3} />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#06b6d4" />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#a855f7" />
    </>
  );
}

export function CoinFlip3D({ isFlipping, result, onFlipComplete, autoFlip = false }: CoinFlip3DProps) {
  return (
    <div className="w-full h-64 sm:h-80 md:h-96 rounded-lg overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/20">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 5, 8]} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
        />

        <Physics gravity={[0, -20, 0]}>
          <Coin
            isFlipping={isFlipping}
            result={result}
            onFlipComplete={onFlipComplete}
            autoFlip={autoFlip}
          />
          <Ground />
        </Physics>

        <Lights />
      </Canvas>
    </div>
  );
}

// Simplified 2D CSS version for lightweight alternative
export function CoinFlip2D({ isFlipping, result, onFlipComplete }: CoinFlip3DProps) {
  const [flips, setFlips] = useState(0);

  useEffect(() => {
    if (isFlipping) {
      setFlips(0);
      const interval = setInterval(() => {
        setFlips((prev) => {
          if (prev >= 5) {
            clearInterval(interval);
            if (onFlipComplete) {
              setTimeout(onFlipComplete, 500);
            }
            return prev;
          }
          return prev + 1;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [isFlipping, onFlipComplete]);

  const showHeads = flips >= 5 ? !result : flips % 2 === 0;

  return (
    <div className="w-full h-64 sm:h-80 md:h-96 flex items-center justify-center">
      <div
        className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full flex items-center justify-center text-5xl sm:text-6xl md:text-7xl transition-all duration-300 ${
          isFlipping && flips < 5 ? 'animate-flip' : ''
        }`}
        style={{
          background: showHeads
            ? 'linear-gradient(135deg, #facc15 0%, #eab308 100%)'
            : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          boxShadow: showHeads
            ? '0 0 40px rgba(250, 204, 21, 0.5)'
            : '0 0 40px rgba(6, 182, 212, 0.5)',
        }}
      >
        {showHeads ? '👑' : '🪙'}
      </div>
    </div>
  );
}
