'use client';

import { useState, useEffect } from 'react';

interface CoinFlip2DProps {
  isFlipping: boolean;
  result?: boolean; // false = heads, true = tails
  onFlipComplete?: () => void;
}

// Lightweight 2D CSS coin flip animation (no Three.js dependency)
export function CoinFlip2D({ isFlipping, result, onFlipComplete }: CoinFlip2DProps) {
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
