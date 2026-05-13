'use client';

import { useGameStore } from '@/store/gameStore';
import { getCoinSideEmoji } from '@/lib/utils';
import { Info } from 'lucide-react';

export function CoinChoice() {
  const { coinChoice, setCoinChoice } = useGameStore();

  const choices = [
    { value: false, label: 'Heads', emoji: getCoinSideEmoji(false), description: "The King's Side" },
    { value: true, label: 'Tails', emoji: getCoinSideEmoji(true), description: 'The Lucky Coin' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1.5">
        <h3
          className="text-xl font-bold"
          style={{ background: 'linear-gradient(135deg, #67e8f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          Heads or Tails? 🪙
        </h3>
        <p className="text-sm text-slate-400 text-center">Pick your side — 50/50 chance to win!</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {choices.map((choice) => {
          const isSelected = coinChoice === choice.value;

          return (
            <button
              key={choice.label}
              onClick={() => setCoinChoice(choice.value)}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-200 cursor-pointer"
              style={
                isSelected
                  ? {
                      background: 'rgba(6,182,212,0.1)',
                      border: '2px solid rgba(6,182,212,0.6)',
                      boxShadow: '0 0 24px rgba(6,182,212,0.2), inset 0 0 24px rgba(6,182,212,0.05)',
                      transform: 'scale(1.04)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '2px solid rgba(255,255,255,0.08)',
                    }
              }
              onMouseEnter={e => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(6,182,212,0.3)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(6,182,212,0.05)';
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)';
                }
              }}
            >
              <span className={`text-6xl transition-transform duration-300 ${isSelected ? 'animate-flip' : ''}`}>
                {choice.emoji}
              </span>
              <span className={`text-lg font-bold ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                {choice.label}
              </span>
              <span className="text-xs text-slate-500">{choice.description}</span>
            </button>
          );
        })}
      </div>

      {coinChoice !== null && (
        <div
          className="rounded-xl p-4 flex flex-col items-center gap-1.5 animate-slide-up"
          style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <p className="text-sm font-bold text-cyan-400">✓ You chose: {coinChoice ? 'Tails' : 'Heads'} {getCoinSideEmoji(coinChoice)}</p>
          <p className="text-xs text-slate-400">Your opponent gets: {!coinChoice ? 'Tails' : 'Heads'} {getCoinSideEmoji(!coinChoice)}</p>
          <p className="text-xs text-green-400">If it lands {coinChoice ? 'Tails' : 'Heads'}, you win! 🎉</p>
        </div>
      )}

      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
      >
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <p className="text-xs text-slate-400">
          🎲 Powered by Chainlink VRF — Provably fair and impossible to predict
        </p>
      </div>
    </div>
  );
}
