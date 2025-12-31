'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Shared timer for countdown displays
 *
 * Instead of each component running its own setInterval,
 * this creates a single global timer that all subscribers share.
 * This significantly reduces timer overhead when displaying many countdowns.
 *
 * Usage:
 *   const tick = useSharedTimer(1000); // Updates every 1 second
 *   // tick changes every second, triggering re-render
 */

// Global timer state
let globalTick = 0;
let globalInterval: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<() => void>();

function startGlobalTimer(intervalMs: number) {
  if (globalInterval) return;

  globalInterval = setInterval(() => {
    globalTick++;
    subscribers.forEach(callback => callback());
  }, intervalMs);
}

function stopGlobalTimer() {
  if (globalInterval && subscribers.size === 0) {
    clearInterval(globalInterval);
    globalInterval = null;
  }
}

/**
 * Hook to subscribe to the shared timer
 * Returns a tick counter that increments on each interval
 *
 * @param intervalMs - Timer interval in milliseconds (default: 1000ms)
 * @param enabled - Whether to subscribe to updates (default: true)
 */
export function useSharedTimer(intervalMs: number = 1000, enabled: boolean = true): number {
  const [tick, setTick] = useState(globalTick);
  const callbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Create callback that updates local state
    const callback = () => {
      setTick(globalTick);
    };
    callbackRef.current = callback;

    // Subscribe
    subscribers.add(callback);
    startGlobalTimer(intervalMs);

    // Sync initial tick
    setTick(globalTick);

    return () => {
      if (callbackRef.current) {
        subscribers.delete(callbackRef.current);
        callbackRef.current = null;
      }
      stopGlobalTimer();
    };
  }, [intervalMs, enabled]);

  return tick;
}

/**
 * Get subscriber count (for debugging)
 */
export function getSharedTimerSubscriberCount(): number {
  return subscribers.size;
}
