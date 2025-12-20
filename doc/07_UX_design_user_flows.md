# UX Design & User Flows
## Complete User Experience Specification

---

## Document Purpose

This document provides everything needed to create a polished, casino-grade user experience:
- Complete user journey maps
- Screen-by-screen UI specifications
- Interaction patterns and microinteractions
- Error and loading states
- Accessibility requirements
- Mobile-first responsive design
- Performance optimization

---

## Table of Contents

1. [UX Philosophy](#1-ux-philosophy)
2. [User Personas](#2-user-personas)
3. [Complete User Journeys](#3-complete-user-journeys)
4. [Screen Specifications](#4-screen-specifications)
5. [Component Design System](#5-component-design-system)
6. [Interaction Patterns](#6-interaction-patterns)
7. [Loading & Error States](#7-loading--error-states)
8. [Animations & Microinteractions](#8-animations--microinteractions)
9. [Mobile Optimization](#9-mobile-optimization)
10. [Accessibility](#10-accessibility)

---

## 1. UX Philosophy

### 1.1 Core Principles

```
THE 5 UX COMMANDMENTS:

1. CLARITY OVER CLEVERNESS
   ├── Every action has a clear purpose
   ├── No hidden fees or surprises
   └── Transparent odds (50/50)

2. SPEED OVER BLOAT
   ├── 3 taps maximum to start playing
   ├── <2 second page loads
   └── Instant visual feedback

3. TRUST OVER FEATURES
   ├── Show transaction previews
   ├── Explain blockchain waits
   └── Provide proof of fairness

4. MOBILE OVER DESKTOP
   ├── Design for thumbs first
   ├── One-handed operation
   └── Works on 375px width

5. DELIGHT OVER DECORATION
   ├── Purposeful animations
   ├── Satisfying interactions
   └── Celebrate wins, soften losses
```

### 1.2 What Makes Great Gambling UX

```
TRADITIONAL CASINO FEELS:
✅ Instant visual feedback
✅ Satisfying sound effects
✅ Clear win/loss states
✅ Easy to retry
✅ Visible fairness

BLOCKCHAIN CHALLENGES:
❌ Transaction confirmation waits
❌ Gas fees
❌ Wallet connection friction
❌ Network errors

OUR SOLUTIONS:
✅ Show every transaction step
✅ Optimistic UI updates
✅ Clear gas fee previews
✅ Graceful error recovery
✅ Progressive enhancement
```

---

## 2. User Personas

### 2.1 Primary Persona: "Casual Crypto Gambler"

```
MEET ALEX (28, CRYPTO-CURIOUS)

Background:
├── Has used crypto for 6 months
├── Comfortable with MetaMask
├── Plays online poker occasionally
├── $100-500 monthly gambling budget
└── Uses mobile 80% of the time

Goals:
├── Quick, fun gambling experience
├── Fair odds (sick of house edges)
├── Easy deposits (already has USDC)
└── Play during commute

Pain Points:
├── Confusing blockchain UIs
├── Slow transaction confirmations
├── Gas fees eating into bets
└── Can't verify fairness on centralized sites

What Alex Needs:
✅ One-tap game start
✅ Clear transaction feedback
✅ Mobile-first design
✅ Visible proof of fairness
```

### 2.2 Secondary Persona: "Blockchain Enthusiast"

```
MEET JORDAN (35, CRYPTO-NATIVE)

Background:
├── Daily DeFi user
├── Has hardware wallet
├── Values decentralization
├── Tech-savvy, reads code
└── Higher risk tolerance

Goals:
├── Provably fair gambling
├── Non-custodial platform
├── Support for various chains
└── Transparent smart contracts

Pain Points:
├── Centralized casinos (doesn't trust)
├── Custodial requirements
├── Hidden odds manipulation
└── No source code visibility

What Jordan Needs:
✅ Verifiable contract source
✅ VRF randomness proof
✅ Hardware wallet support
✅ Block explorer links
```

---

## 3. Complete User Journeys

### 3.1 First-Time User Journey

```
JOURNEY: "FIRST GAME"
Estimated Time: 2 minutes

┌─────────────────────────────────────────┐
│ STEP 1: LANDING PAGE                    │
│ Duration: 5 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── Hero: "50/50 Crypto Coin Flip"    │
│ ├── Subtext: "Provably Fair. No House"│
│ ├── [Connect Wallet] (primary CTA)    │
│ └── Stats: "X games today, Y winners" │
│                                         │
│ User Action:                            │
│ └── Clicks "Connect Wallet"            │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 2: WALLET CONNECTION               │
│ Duration: 10 seconds                    │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── Wallet options (MetaMask, etc)    │
│ ├── Security disclaimer                │
│ └── "Never share private keys"        │
│                                         │
│ User Action:                            │
│ ├── Selects MetaMask                   │
│ └── Approves connection in wallet      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 3: TIER SELECTION                  │
│ Duration: 3 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── 5 bet tiers: [$5] [$10] [$25]...  │
│ ├── Balance shown: "Your: $127"       │
│ ├── Each tier shows:                   │
│ │   ├── Win amount                     │
│ │   ├── Players in queue               │
│ │   └── Grayed if can't afford        │
│ └── Recommended: $25 (highlighted)     │
│                                         │
│ User Action:                            │
│ └── Taps $25 tier                      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 4: COIN CHOICE                     │
│ Duration: 2 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── "Choose Your Side"                 │
│ ├── [🪙 Heads] [🪙 Tails]              │
│ └── Animation on hover                  │
│                                         │
│ User Action:                            │
│ └── Taps Heads                         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 5: CONFIRMATION                    │
│ Duration: 3 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── "Review Your Bet"                  │
│ ├── Bet: $25                           │
│ ├── Win: $49                           │
│ ├── Fee: $1 (2%)                       │
│ ├── Gas: ~$0.50                        │
│ ├── Your choice: Heads                 │
│ ├── ─────────────────                  │
│ ├── Total: $25.50                      │
│ └── [Confirm & Play]                   │
│                                         │
│ User Action:                            │
│ └── Taps "Confirm & Play"              │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 6: WALLET SIGNATURE                │
│ Duration: 5 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── "Waiting for wallet approval..."  │
│ ├── Spinner animation                  │
│ └── MetaMask popup appears             │
│                                         │
│ User Action:                            │
│ └── Approves transaction in wallet     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 7: FINDING OPPONENT                │
│ Duration: 0-10 seconds                  │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── "🔍 Finding opponent..."           │
│ ├── Timer: 0:03                        │
│ ├── "8 players looking"                │
│ ├── [Cancel] button                    │
│ └── Pulsing animation                  │
│                                         │
│ System Action:                          │
│ └── Queue matching algorithm runs       │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 8: OPPONENT FOUND                  │
│ Duration: 2 seconds                     │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── "⚡ Opponent Found!"               │
│ ├── Opponent: 0x5AB...F21              │
│ ├── Their choice: Tails                │
│ ├── Pot: $50 → Winner gets $49        │
│ └── Automatic countdown: 3...2...1...  │
│                                         │
│ System Action:                          │
│ └── Both players' txs confirmed         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 9: COIN FLIP ANIMATION             │
│ Duration: 5-10 seconds                  │
├─────────────────────────────────────────┤
│ What User Sees:                         │
│ ├── Coin spinning in 3D                │
│ ├── "Generating fair result..."        │
│ ├── Progress indicator                 │
│ ├── Cannot skip (fairness guarantee)   │
│ └── Sound effect (if enabled)          │
│                                         │
│ System Action:                          │
│ ├── VRF request sent                   │
│ ├── Waiting for Chainlink callback     │
│ └── Result determined on-chain         │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ STEP 10: RESULT                         │
│ Duration: View as long as wanted       │
├─────────────────────────────────────────┤
│ IF WIN:                                 │
│ ├── 🎉 "YOU WON!" (large, animated)   │
│ ├── +$49 USDC (green, pulsing)        │
│ ├── Result: 🪙 Heads                   │
│ ├── ─────────────────                  │
│ ├── Funds sent to your wallet          │
│ ├── Tx: 0xabc... [View]               │
│ ├── ─────────────────                  │
│ ├── [Play Again] [Double Bet]         │
│ └── [▼ Verify Fairness]               │
│                                         │
│ IF LOSS:                                │
│ ├── "You Lost" (empathetic tone)      │
│ ├── -$25 USDC                          │
│ ├── Result: 🪙 Tails                   │
│ ├── "Fair flip. Better luck next!"    │
│ ├── ─────────────────                  │
│ ├── [Try Again] [Change Bet]          │
│ └── [▼ Verify Fairness]               │
└─────────────────────────────────────────┘

TOTAL FIRST GAME TIME: ~60-90 seconds
```

### 3.2 Returning User Journey

```
JOURNEY: "QUICK REPLAY"
Estimated Time: 20 seconds

┌─────────────────────────────────────────┐
│ RETURNING USER (wallet auto-connected) │
├─────────────────────────────────────────┤
│ ├── Sees: "Welcome back! Balance: $x" │
│ ├── Last bet tier pre-selected         │
│ ├── [Quick Play] button prominent      │
│ └── Skips straight to confirmation     │
└─────────────────────────────────────────┘
                  ↓
           (Steps 5-10 from above)
           
OPTIMIZATION:
├── Saved preferences (tier, sound)
├── One-tap replay
├── Familiar flow
└── <30 second game time
```

---

## 4. Screen Specifications

### 4.1 Home Page / Landing

```
┌──────────────────────────────────────┐
│ [Logo]              [Connect Wallet] │  ← Header
├──────────────────────────────────────┤
│                                      │
│         🪙 COIN FLIP 🪙              │  ← Hero
│                                      │
│    Provably Fair. 50/50 Odds.       │
│      No House Edge. No BS.          │
│                                      │
│      [🎮 Play Now (connect wallet)] │  ← Primary CTA
│                                      │
├──────────────────────────────────────┤
│  Quick Stats:                        │  ← Social Proof
│  ├─ 🎯 1,247 games today            │
│  ├─ 💰 $52,340 volume               │
│  └─ ⚡ Avg. 15s per game            │
├──────────────────────────────────────┤
│  How It Works:                       │  ← Value Props
│  ┌────────┬────────┬────────┐       │
│  │ Choose │  Flip  │  Win   │       │
│  │  Bet   │  Coin  │ 2x-Fee │       │
│  └────────┴────────┴────────┘       │
├──────────────────────────────────────┤
│  Why Trust Us?                       │  ← Trust Signals
│  ├─ ✅ Chainlink VRF (verifiable)   │
│  ├─ ✅ Non-custodial (your keys)   │
│  ├─ ✅ Open source contract        │
│  └─ ✅ Audited by [Firm]           │
├──────────────────────────────────────┤
│  [Recent Wins]    [Leaderboard]     │  ← Engagement
└──────────────────────────────────────┘

RESPONSIVE BREAKPOINTS:
Mobile (<768px):  Stack vertically, full width CTAs
Tablet (768-1024): 2-column layout for "How It Works"
Desktop (>1024):   3-column, side-by-side stats
```

### 4.2 Play Page (Main Experience)

```
DESKTOP LAYOUT (>1024px):
┌──────────────────────────────────────────────┐
│ [Logo] [Play] [History]    [@wallet] [$bal] │ ← Header
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────┐  ┌────────────────┐ │
│  │   GAME AREA        │  │   SIDEBAR      │ │
│  │                    │  │                │ │
│  │  [Tier Selection]  │  │  Live Games:   │ │
│  │                    │  │  ┌──────────┐  │ │
│  │  [Coin Choice]     │  │  │ $25 game │  │ │
│  │                    │  │  │ 0x5AB... │  │ │
│  │  [Confirm]         │  │  │ [Join]   │  │ │
│  │                    │  │  └──────────┘  │ │
│  │                    │  │  ┌──────────┐  │ │
│  │  OR                │  │  │ $50 game │  │ │
│  │                    │  │  │ ...      │  │ │
│  │  [Active Game]     │  │  └──────────┘  │ │
│  │  [Coin Animation]  │  │                │ │
│  │                    │  │  Stats:        │ │
│  └────────────────────┘  │  Win Rate: 52% │ │
│                          │  Games: 47     │ │
│                          └────────────────┘ │
└──────────────────────────────────────────────┘

MOBILE LAYOUT (<768px):
┌──────────────────────┐
│ [≡] CoinFlip  [$bal] │ ← Compact header
├──────────────────────┤
│                      │
│  [Tier Selection]    │ ← Full width
│  ┌──┬──┬──┬──┬──┐   │
│  │$5│10│25│50│XX│   │ ← Horizontal scroll
│  └──┴──┴──┴──┴──┘   │
│                      │
│  Choose Side:        │
│  ┌────────────────┐  │
│  │   🪙 HEADS    │  │ ← Stack vertically
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │   🪙 TAILS    │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │  PLAY NOW ►    │  │ ← Thumb-friendly
│  └────────────────┘  │
│                      │
│  [Tabs: Play|Lobby]  │ ← Tab navigation
└──────────────────────┘
```

### 4.3 Transaction Status Screen

```
┌──────────────────────────────────────┐
│     Transaction Progress             │
├──────────────────────────────────────┤
│                                      │
│  ✓ 1. Wallet approval                │ ← Completed
│  ⏳ 2. Transaction sent               │ ← Active
│  ⏳ 3. Confirming (2/3 blocks)        │ ← Pending
│  ⏳ 4. Generating random result       │ ← Pending
│  ⏳ 5. Paying winner                  │ ← Pending
│                                      │
│  ─────────────────────────────       │
│                                      │
│  Tx: 0xabc...def                     │
│  [Copy] [View on Explorer]           │
│                                      │
│  ⚠️ This may take 30-60 seconds     │
│     Please don't close this page     │
│                                      │
└──────────────────────────────────────┘

STATES:
├── Waiting: Gray circle
├── Active: Blue spinner
├── Complete: Green checkmark
└── Error: Red X
```

---

## 5. Component Design System

### 5.1 Typography Scale

```css
/* Font Family */
--font-primary: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;

/* Size Scale (Mobile First) */
--text-xs:   0.75rem;  /* 12px - Helper text */
--text-sm:   0.875rem; /* 14px - Body small */
--text-base: 1rem;     /* 16px - Body */
--text-lg:   1.125rem; /* 18px - Emphasis */
--text-xl:   1.25rem;  /* 20px - H4 */
--text-2xl:  1.5rem;   /* 24px - H3 */
--text-3xl:  1.875rem; /* 30px - H2 */
--text-4xl:  2.25rem;  /* 36px - H1 */

/* Desktop Scale (>768px) */
@media (min-width: 768px) {
  --text-3xl: 2.25rem;  /* 36px */
  --text-4xl: 3rem;     /* 48px */
}

/* Weight */
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
```

### 5.2 Color Palette

```css
/* Brand Colors */
--color-primary: #3B82F6;    /* Blue - CTAs */
--color-secondary: #8B5CF6;  /* Purple - Accents */
--color-success: #10B981;    /* Green - Wins */
--color-error: #EF4444;      /* Red - Losses */
--color-warning: #F59E0B;    /* Orange - Warnings */

/* Neutral Scale */
--color-gray-50: #F9FAFB;
--color-gray-100: #F3F4F6;
--color-gray-200: #E5E7EB;
--color-gray-300: #D1D5DB;
--color-gray-400: #9CA3AF;
--color-gray-500: #6B7280;
--color-gray-600: #4B5563;
--color-gray-700: #374151;
--color-gray-800: #1F2937;
--color-gray-900: #111827;

/* Semantic Colors */
--color-background: #FFFFFF;
--color-surface: var(--color-gray-50);
--color-border: var(--color-gray-200);
--color-text: var(--color-gray-900);
--color-text-muted: var(--color-gray-600);

/* Dark Mode (Optional) */
@media (prefers-color-scheme: dark) {
  --color-background: #111827;
  --color-surface: #1F2937;
  --color-border: #374151;
  --color-text: #F9FAFB;
  --color-text-muted: #9CA3AF;
}
```

### 5.3 Spacing Scale

```css
/* 8px base unit */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### 5.4 Button Components

```tsx
// Button variants
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

// Primary Button
<button className="
  px-6 py-3
  bg-blue-600 hover:bg-blue-700
  text-white font-semibold
  rounded-lg
  transition-all duration-200
  active:scale-95
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Play Now
</button>

// Secondary Button
<button className="
  px-6 py-3
  bg-white border-2 border-gray-300
  text-gray-700 font-semibold
  rounded-lg
  hover:border-gray-400 hover:bg-gray-50
  transition-all duration-200
">
  Cancel
</button>

// Sizes
.btn-sm { padding: 0.5rem 1rem; font-size: 0.875rem; }
.btn-md { padding: 0.75rem 1.5rem; font-size: 1rem; }
.btn-lg { padding: 1rem 2rem; font-size: 1.125rem; }
```

### 5.5 Card Components

```tsx
// Base Card
<div className="
  bg-white
  border border-gray-200
  rounded-xl
  shadow-sm
  p-6
  transition-shadow
  hover:shadow-md
">
  {children}
</div>

// Tier Card
<button className="
  relative
  p-6
  bg-white
  border-2 border-gray-200
  rounded-xl
  transition-all duration-200
  hover:border-blue-500
  hover:shadow-lg
  active:scale-95
  
  // Selected state
  data-[selected=true]:border-blue-500
  data-[selected=true]:bg-blue-50
  
  // Disabled state
  disabled:opacity-50
  disabled:cursor-not-allowed
">
  <div className="text-3xl font-bold">$25</div>
  <div className="text-sm text-gray-600 mt-2">
    Win: $49
  </div>
</button>
```

---

## 6. Interaction Patterns

### 6.1 Button States

```tsx
// All buttons must show these states:

// 1. Default
<button className="bg-blue-600">Play</button>

// 2. Hover (desktop only)
<button className="hover:bg-blue-700">Play</button>

// 3. Active/Pressed
<button className="active:scale-95">Play</button>

// 4. Focused (keyboard navigation)
<button className="focus:ring-4 focus:ring-blue-300">
  Play
</button>

// 5. Loading
<button disabled className="opacity-75">
  <Spinner /> Processing...
</button>

// 6. Disabled
<button disabled className="opacity-50 cursor-not-allowed">
  Insufficient Balance
</button>
```

### 6.2 Form Interactions

```tsx
// Input field states
<input className="
  w-full px-4 py-3
  border-2 border-gray-300
  rounded-lg
  transition-all
  
  // Focus
  focus:border-blue-500
  focus:ring-4
  focus:ring-blue-100
  
  // Error
  data-[error=true]:border-red-500
  data-[error=true]:ring-red-100
  
  // Success
  data-[success=true]:border-green-500
  data-[success=true]:ring-green-100
" />

// Error message
{error && (
  <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
    <AlertCircle className="w-4 h-4" />
    {error}
  </p>
)}
```

### 6.3 Hover Effects

```css
/* Card hover */
.card {
  transition: all 0.2s ease-out;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

/* Button hover */
.button {
  transition: all 0.15s ease-in-out;
}

.button:hover {
  transform: scale(1.02);
}

.button:active {
  transform: scale(0.98);
}

/* Link hover */
.link {
  position: relative;
}

.link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.2s ease-out;
}

.link:hover::after {
  width: 100%;
}
```

---

## 7. Loading & Error States

### 7.1 Loading States

```tsx
// Skeleton Loading
export function TierSelectorSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-32 bg-gray-200 rounded-xl animate-pulse"
        />
      ))}
    </div>
  );
}

// Spinner Component
export function Spinner({ size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className={`${sizeClasses[size]} animate-spin`}>
      <svg className="w-full h-full" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

// Progress Bar
export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

### 7.2 Error States

```tsx
// Error Component
export function ErrorState({
  title,
  message,
  retry
}: ErrorStateProps) {
  return (
    <div className="
      p-6
      bg-red-50
      border border-red-200
      rounded-xl
      text-center
    ">
      <AlertCircle className="
        w-12 h-12
        mx-auto mb-4
        text-red-600
      " />
      
      <h3 className="text-lg font-semibold text-red-900 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-red-700 mb-4">
        {message}
      </p>
      
      {retry && (
        <button
          onClick={retry}
          className="
            px-4 py-2
            bg-red-600 text-white
            rounded-lg
            hover:bg-red-700
          "
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// Specific error messages
const ERROR_MESSAGES = {
  WALLET_REJECTED: "Transaction cancelled. No funds were moved.",
  INSUFFICIENT_BALANCE: "You don't have enough funds for this bet.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  CONTRACT_ERROR: "Smart contract error. Please try again.",
  TIMEOUT: "Request timed out. Please refresh and try again."
};
```

### 7.3 Empty States

```tsx
export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="
      flex flex-col
      items-center justify-center
      py-12
      text-center
    ">
      <div className="mb-4 text-gray-400">
        {icon || <Inbox className="w-16 h-16" />}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h3>
      
      <p className="text-gray-600 max-w-md mb-6">
        {description}
      </p>
      
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}

// Usage
<EmptyState
  title="No games yet"
  description="Start your first coin flip to see your history here."
  action={{
    label: "Play Now",
    onClick: () => router.push('/play')
  }}
/>
```

---

## 8. Animations & Microinteractions

### 8.1 Coin Flip Animation

```tsx
import { motion } from 'framer-motion';

export function CoinFlipAnimation({
  isFlipping,
  result
}: CoinFlipAnimationProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        className="relative w-32 h-32"
        animate={{
          rotateY: isFlipping ? [0, 3600] : result ? 180 : 0
        }}
        transition={{
          duration: isFlipping ? 3 : 0.5,
          ease: isFlipping ? 'linear' : 'easeOut'
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Heads side */}
        <div className="
          absolute inset-0
          backface-hidden
          bg-gradient-to-br from-yellow-400 to-yellow-600
          rounded-full
          flex items-center justify-center
          text-6xl
          shadow-xl
        ">
          👑
        </div>
        
        {/* Tails side */}
        <div className="
          absolute inset-0
          backface-hidden
          bg-gradient-to-br from-yellow-400 to-yellow-600
          rounded-full
          flex items-center justify-center
          text-6xl
          shadow-xl
        " style={{ transform: 'rotateY(180deg)' }}>
          🪙
        </div>
      </motion.div>
    </div>
  );
}
```

### 8.2 Result Reveal Animation

```tsx
export function ResultReveal({ isWin }: { isWin: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 15
      }}
      className={`
        text-center p-8 rounded-2xl
        ${isWin ? 'bg-green-50' : 'bg-gray-50'}
      `}
    >
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2 }}
        className={`
          text-6xl font-bold mb-4
          ${isWin ? 'text-green-600' : 'text-gray-600'}
        `}
      >
        {isWin ? '🎉 YOU WON!' : '😔 YOU LOST'}
      </motion.div>
      
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, type: 'spring' }}
        className={`
          text-4xl font-bold
          ${isWin ? 'text-green-600' : 'text-gray-600'}
        `}
      >
        {isWin ? '+$49' : '-$25'}
      </motion.div>
    </motion.div>
  );
}
```

### 8.3 Notification Toast

```tsx
// Success toast
toast.success('Game created successfully!', {
  icon: '🎮',
  duration: 3000,
  position: 'bottom-right',
  style: {
    background: '#10B981',
    color: '#fff',
    borderRadius: '12px',
    padding: '16px'
  }
});

// Error toast
toast.error('Transaction failed', {
  icon: '❌',
  duration: 4000
});

// Loading toast
const loadingToast = toast.loading('Confirming transaction...');

// Update loading toast
toast.success('Transaction confirmed!', {
  id: loadingToast
});
```

---

## 9. Mobile Optimization

### 9.1 Touch Targets

```css
/* Minimum touch target: 44x44px (iOS guideline) */
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 24px;
}

/* Increase tap area without changing visual size */
.link {
  position: relative;
}

.link::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
}
```

### 9.2 Responsive Typography

```css
/* Fluid typography */
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
}

body {
  font-size: clamp(1rem, 2vw, 1.125rem);
}

/* Prevent text zoom on iOS */
input, select, textarea {
  font-size: 16px; /* Prevents zoom */
}
```

### 9.3 Mobile Navigation

```tsx
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      {/* Hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>
      
      {/* Slide-out menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Menu */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="
                fixed right-0 top-0 bottom-0
                w-64 bg-white
                shadow-2xl
                z-50 p-6
                overflow-y-auto
              "
            >
              {/* Menu content */}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

---

## 10. Accessibility

### 10.1 Keyboard Navigation

```tsx
// All interactive elements must be keyboard accessible
<button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
  tabIndex={0}
>
  Play
</button>

// Skip to main content
<a
  href="#main"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
>
  Skip to main content
</a>
```

### 10.2 Screen Reader Support

```tsx
// Proper ARIA labels
<button aria-label="Create $25 coin flip game">
  $25
</button>

// Live regions for dynamic updates
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {status}
</div>

// Loading states
<button disabled aria-busy="true">
  <span className="sr-only">Loading...</span>
  <Spinner aria-hidden="true" />
</button>
```

### 10.3 Color Contrast

```css
/* WCAG AA minimum contrast ratios */

/* Normal text: 4.5:1 */
.text {
  color: #1F2937; /* gray-800 on white = 10.7:1 ✅ */
}

/* Large text (18px+): 3:1 */
.heading {
  color: #374151; /* gray-700 on white = 8.6:1 ✅ */
}

/* Interactive elements: 3:1 */
.button {
  background: #3B82F6; /* blue-600 = 4.6:1 ✅ */
}

/* Never rely on color alone */
.error {
  color: #EF4444; /* Red */
  border: 2px solid currentColor; /* Also use border */
}
```

---

## Conclusion

This UX specification provides:

✅ **Complete user journeys** from landing to payout  
✅ **Screen-by-screen specifications** for implementation  
✅ **Component design system** for consistency  
✅ **Interaction patterns** for polish  
✅ **Mobile-first responsive design**  
✅ **Accessibility guidelines** for inclusion  
✅ **Animation patterns** for delight

**The goal: Make crypto gambling feel as smooth as a traditional casino, while maintaining the transparency and fairness that only blockchain can provide.**

