# CoinFlip 5-Color Theme System

**Last Updated:** December 23, 2025
**Version:** 2.0

---

## 🎨 Overview

The CoinFlip application uses a **strict 5-color system** for all UI elements, ensuring visual consistency and professional design across the entire platform.

### The 5 Colors

| Color | Hex Code | Tailwind | Purpose | Usage |
|-------|----------|----------|---------|-------|
| **Primary (Cyan)** | `#06b6d4` | `cyan-500` | Main brand color | Primary actions, matched games, main accents |
| **Warning (Yellow)** | `#facc15` | `yellow-400` | Pending/queue states | Pending games, coin gold, warnings, alerts |
| **Success (Green)** | `#22c55e` | `green-500` | Success/win states | Resolved games, wins, success messages |
| **Danger (Red)** | `#ef4444` | `red-500` | Error/loss states | Cancelled games, errors, losses |
| **Accent (Purple)** | `#a855f7` | `purple-500` | Secondary highlights | Tier accents, premium features, variety |

**Neutral Base:** Slate grays (`slate-50` through `slate-950`) are used for backgrounds and text but are not counted in the 5-color system.

---

## 📚 Quick Reference

### Game State Mapping

```typescript
pending   → Yellow (#facc15)  // Waiting for opponent
matched   → Cyan   (#06b6d4)  // Game in progress
resolved  → Green  (#22c55e)  // Game completed (won)
cancelled → Red    (#ef4444)  // Game cancelled (lost)
```

### Semantic Colors

```typescript
primary  → Cyan   (#06b6d4)  // Main actions, brand
warning  → Yellow (#facc15)  // Alerts, pending, caution
success  → Green  (#22c55e)  // Wins, confirmations
danger   → Red    (#ef4444)  // Errors, losses
accent   → Purple (#a855f7)  // Highlights, variety
```

---

## 🛠️ Implementation

### CSS Variables (globals.css)

```css
:root {
  --color-primary: 6, 182, 212;      /* Cyan */
  --color-warning: 250, 204, 21;     /* Yellow */
  --color-success: 34, 197, 94;      /* Green */
  --color-danger: 239, 68, 68;       /* Red */
  --color-accent: 168, 85, 247;      /* Purple */
}
```

### Tailwind Utility Classes

#### Text Colors
```tsx
className="text-cyan-400"    // Primary
className="text-yellow-400"  // Warning
className="text-green-400"   // Success
className="text-red-400"     // Danger
className="text-purple-400"  // Accent
```

#### Background Colors
```tsx
className="bg-cyan-500/20"    // Primary with opacity
className="bg-yellow-400/20"  // Warning with opacity
className="bg-green-500/20"   // Success with opacity
className="bg-red-500/20"     // Danger with opacity
className="bg-purple-500/20"  // Accent with opacity
```

#### Border Colors
```tsx
className="border-cyan-500/30"
className="border-yellow-400/30"
className="border-green-500/30"
className="border-red-500/30"
className="border-purple-500/30"
```

### Glow Effects

```tsx
className="glow-primary"   // Cyan glow
className="glow-warning"   // Yellow glow
className="glow-success"   // Green glow
className="glow-danger"    // Red glow
className="glow-accent"    // Purple glow

// Aliases for game states
className="glow-matched"   // = glow-primary
className="glow-pending"   // = glow-warning
className="glow-resolved"  // = glow-success
className="glow-cancelled" // = glow-danger
```

### Neon Borders

```tsx
className="neon-border-primary"  // Cyan neon
className="neon-border-warning"  // Yellow neon
className="neon-border-success"  // Green neon
className="neon-border-danger"   // Red neon
className="neon-border-accent"   // Purple neon
```

### Gradient Text

```tsx
className="text-gradient-primary"      // Cyan → Purple
className="text-gradient-warning"      // Yellow gradient (gold)
className="text-gradient-success"      // Green gradient
className="text-gradient-accent"       // Purple gradient
className="text-gradient-rainbow"      // Cyan → Purple → Yellow
```

---

## 📦 Component Usage

### Radix UI Color Props

```tsx
// Buttons, Badges, Callouts, etc.
<Button color="cyan">      // Primary
<Badge color="yellow">     // Warning
<Callout color="green">    // Success
<Badge color="red">        // Danger
<Badge color="purple">     // Accent
```

### Stats Cards

```tsx
<StatsCard
  icon={<Icon className="w-5 h-5 text-cyan-400" />}
  label="Label"
  value={value}
  color="cyan"
  glowClass="glow-primary"
/>
```

### Status Badges

```tsx
<StatusBadge status="pending" />   // Yellow
<StatusBadge status="matched" />   // Cyan
<StatusBadge status="resolved" />  // Green
<StatusBadge status="cancelled" /> // Red
```

---

## 🎯 Common Patterns

### Card Variants

```tsx
// Primary card
<Card className="glass glow-primary border-cyan-500/30">

// Warning card
<Card className="glass glow-warning border-yellow-400/30">

// Success card
<Card className="glass glow-success border-green-500/30">

// Danger card
<Card className="glass glow-danger border-red-500/30">

// Accent card
<Card className="glass glow-accent border-purple-500/30">
```

### Button States

```tsx
<Button className="hover:glow-primary cursor-pointer">
<Button className="hover:glow-warning cursor-pointer">
<Button className="hover:glow-success cursor-pointer">
<Button className="hover:glow-danger cursor-pointer">
<Button className="hover:glow-accent cursor-pointer">
```

### Icon Colors

```tsx
<Icon className="w-5 h-5 text-cyan-400" />    // Primary
<Icon className="w-5 h-5 text-yellow-400" />  // Warning
<Icon className="w-5 h-5 text-green-400" />   // Success
<Icon className="w-5 h-5 text-red-400" />     // Danger
<Icon className="w-5 h-5 text-purple-400" />  // Accent
```

---

## 🔍 Theme Configuration Files

### Core Files

1. **`lib/theme.ts`** - Centralized theme configuration
   - Color definitions with RGB values
   - Helper functions (`rgba()`, `colorWithOpacity()`)
   - Semantic color mapping

2. **`app/globals.css`** - CSS utilities
   - Glow effects for all 5 colors
   - Neon borders
   - Gradient text classes
   - Game state styles

3. **`tailwind.config.ts`** - Tailwind configuration
   - Game state color mapping
   - Custom animations
   - Background gradients

---

## 🎨 Special Use Cases

### Rank Badges (Leaderboard)

```tsx
1st Place → Yellow (gold)     bg-gradient-to-br from-yellow-300 to-yellow-500
2nd Place → Cyan (silver)     bg-gradient-to-br from-cyan-400 to-cyan-600
3rd Place → Purple (bronze)   bg-gradient-to-br from-purple-400 to-purple-600
```

### Confetti Colors

```typescript
colors: ['#06b6d4', '#facc15', '#22c55e', '#ef4444', '#a855f7']
// Cyan, Yellow, Green, Red, Purple
```

### Particle Effects

```typescript
BackgroundParticles: ['#06b6d4', '#a855f7', '#22c55e']  // Cyan, Purple, Green
CoinParticles: '#facc15'  // Yellow
```

### 3D Lighting

```typescript
<pointLight color="#06b6d4" />  // Cyan light
<pointLight color="#a855f7" />  // Purple light
```

---

## ✅ Best Practices

### DO ✓

- Use semantic color names (`glow-primary` not `glow-cyan`)
- Maintain opacity consistency (`/20`, `/30`, `/40`)
- Use CSS variables for rgba values
- Stick to the 5-color palette strictly
- Use Tailwind's default color scales for shades

### DON'T ✗

- Don't use orange, pink, blue, or other colors
- Don't use arbitrary hex values outside the 5 colors
- Don't mix semantic and direct color names
- Don't use inline styles for colors (use classes)
- Don't create new color variants without updating this guide

---

## 🔄 Migration Guide

### Replacing Old Colors

| Old Color | New Color | Usage |
|-----------|-----------|-------|
| Orange | Yellow | Warnings, 3rd place |
| Pink | Purple | Accents, gradients |
| Blue | Cyan | Primary brand color |
| Teal | Cyan | Primary brand color |

### Find & Replace

```bash
# Find remaining non-standard colors
grep -r "orange\|pink\|blue-" app/ components/

# Check for color="orange"
grep -r 'color="orange"' app/ components/
```

---

## 📊 Color Usage Statistics

### Current Distribution

- **Cyan (Primary):** ~40% - Main brand, primary actions, matched states
- **Yellow (Warning):** ~25% - Pending states, coin gold, warnings
- **Green (Success):** ~20% - Resolved states, wins, success
- **Red (Danger):** ~10% - Cancelled states, errors, losses
- **Purple (Accent):** ~5% - Secondary highlights, variety

---

## 🎓 Examples

### Complete Component Example

```tsx
import { Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Trophy } from 'lucide-react';

export function WinCard({ amount }: { amount: string }) {
  return (
    <Card className="glass glow-success border-2 border-green-500/30">
      <Flex direction="column" gap="4" p="6">
        <Flex align="center" gap="3">
          <Trophy className="w-8 h-8 text-green-400" />
          <Heading size="6" className="text-green-400">
            You Won!
          </Heading>
        </Flex>
        <Text size="5" weight="bold" className="text-gradient-success">
          {amount}
        </Text>
      </Flex>
    </Card>
  );
}
```

### Game Status Component

```tsx
const statusColors = {
  pending: 'yellow',
  matched: 'cyan',
  resolved: 'green',
  cancelled: 'red',
} as const;

export function GameStatus({ status }: { status: GameStatus }) {
  return (
    <Badge
      color={statusColors[status]}
      className={`glow-${status}`}
    >
      {status}
    </Badge>
  );
}
```

---

## 🚀 Future Enhancements

### Potential Additions

- Dark/Light mode toggle (maintaining 5-color system)
- Color accessibility checker
- High contrast mode
- Colorblind-friendly alternatives
- Theme customization (within 5-color constraints)

---

## 📝 Summary

The CoinFlip 5-color system provides:

✅ **Consistency** - All pages use the same color palette
✅ **Clarity** - Each color has a specific semantic meaning
✅ **Accessibility** - High contrast ratios for readability
✅ **Professionalism** - Industry-standard design
✅ **Maintainability** - Easy to update and extend

**Remember:** When adding new features, always reference this guide to maintain color consistency across the application.

---

**Questions?** See `lib/theme.ts` for the centralized configuration or check the component examples in this guide.
