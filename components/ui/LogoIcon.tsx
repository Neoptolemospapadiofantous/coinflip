'use client';

import { useId } from 'react';

interface LogoIconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 28, className }: LogoIconProps) {
  const raw = useId();
  const uid = raw.replace(/:/g, 'x');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        {/* Outer frame body — deep space */}
        <radialGradient id={`bg${uid}`} cx="38%" cy="32%" r="78%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#0c2a4a" />
          <stop offset="55%"  stopColor="#0d0d2b" />
          <stop offset="100%" stopColor="#12012e" />
        </radialGradient>

        {/* Outer rim — cyan → indigo → violet → cyan */}
        <linearGradient id={`rim${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#22d3ee" />
          <stop offset="35%"  stopColor="#818cf8" />
          <stop offset="70%"  stopColor="#c084fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>

        {/* Coin face — warm gold radial */}
        <radialGradient id={`face${uid}`} cx="40%" cy="35%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fef9c3" />
          <stop offset="30%"  stopColor="#fbbf24" />
          <stop offset="70%"  stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>

        {/* Coin face inner rim — slightly brighter gold */}
        <linearGradient id={`faceRim${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="50%"  stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Dollar sign gradient — bright to muted gold */}
        <linearGradient id={`dollar${uid}`} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%"   stopColor="#fefce8" />
          <stop offset="45%"  stopColor="#fde68a" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Rim glow blur */}
        <filter id={`glow${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Outer halo glow ── */}
      <circle
        cx="14" cy="14" r="13.2"
        fill="none"
        stroke={`url(#rim${uid})`}
        strokeWidth="2.5"
        opacity="0.18"
        filter={`url(#glow${uid})`}
      />

      {/* ── Frame background ── */}
      <circle cx="14" cy="14" r="13" fill={`url(#bg${uid})`} />

      {/* ── Outer gradient rim ── */}
      <circle
        cx="14" cy="14" r="13"
        fill="none"
        stroke={`url(#rim${uid})`}
        strokeWidth="1.2"
      />

      {/* ── Milled edge dashes (coin texture between rim and face) ── */}
      <circle
        cx="14" cy="14" r="10.8"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.55"
        strokeDasharray="1.6 1.4"
      />

      {/* ── Coin face ── */}
      <circle cx="14" cy="14" r="9.4" fill={`url(#face${uid})`} />

      {/* ── Coin face rim ── */}
      <circle
        cx="14" cy="14" r="9.4"
        fill="none"
        stroke={`url(#faceRim${uid})`}
        strokeWidth="0.7"
      />

      {/* ── Inner coin ring detail ── */}
      <circle
        cx="14" cy="14" r="7.8"
        fill="none"
        stroke="rgba(146,64,14,0.5)"
        strokeWidth="0.4"
      />

      {/* ── Dollar sign — vertical bar (left) ── */}
      <rect x="13.1" y="8.2" width="1.1" height="11.6" rx="0.55" fill={`url(#dollar${uid})`} />

      {/* ── Dollar sign — S curve (top arc, left open) ── */}
      <path
        d="M 16.2,10.5 C 16.2,9.1 11.6,9.0 11.6,11.1 C 11.6,13.2 16.4,13.0 16.4,15.2 C 16.4,17.4 11.6,17.2 11.6,15.8"
        stroke={`url(#dollar${uid})`}
        strokeWidth="1.35"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Coin face highlight (upper-left arc) ── */}
      <path
        d="M 6.5,10 Q 9.5,5.5 16.5,7.5"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Small specular dot ── */}
      <circle cx="7.5" cy="8.5" r="1.0" fill="rgba(255,255,255,0.35)" />

      {/* ── Metallic sheen band (diagonal across coin face) ── */}
      <ellipse
        cx="11" cy="11.5" rx="3.5" ry="1.2"
        fill="rgba(255,255,255,0.07)"
        transform="rotate(-30, 11, 11.5)"
      />
    </svg>
  );
}
