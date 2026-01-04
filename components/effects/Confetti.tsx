'use client';

import { useEffect, useState } from 'react';
import ReactConfetti from 'react-confetti';
import { useWindowSize } from '@/hooks/useWindowSize';
import { theme } from '@/lib/theme';

interface ConfettiProps {
  show: boolean;
  duration?: number;
  onComplete?: () => void;
}

export function Confetti({ show, duration = 5000, onComplete }: ConfettiProps) {
  const { width, height } = useWindowSize();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (show) {
      setIsActive(true);
      const timer = setTimeout(() => {
        setIsActive(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  if (!isActive) return null;

  return (
    <ReactConfetti
      width={width}
      height={height}
      recycle={false}
      numberOfPieces={500}
      gravity={0.3}
      colors={[
        theme.colors.primary.main,
        theme.colors.warning.main,
        theme.colors.success.main,
        theme.colors.danger.main,
        theme.colors.accent.main,
      ]}
    />
  );
}

// Win celebration with particles and effects
export function WinCelebration({ show, amount }: { show: boolean; amount?: string }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <Confetti show={show} duration={6000} />

      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent animate-pulse" />

      {/* Win message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center animate-slide-up">
          <div className="text-8xl mb-4 animate-bounce">🎉</div>
          <div className="text-6xl font-bold text-gradient-rainbow mb-4">YOU WON!</div>
          {amount && (
            <div className="text-4xl font-bold text-green-400 glow-resolved">{amount}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Loss message (subtle)
export function LossMessage({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="text-6xl mb-4">😔</div>
        <div className="text-3xl font-bold text-gray-400 mb-2">Better Luck Next Time</div>
        <div className="text-lg text-gray-500">Try again!</div>
      </div>
    </div>
  );
}
