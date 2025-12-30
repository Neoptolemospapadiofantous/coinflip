'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { useGameStore } from '@/store/gameStore';

/**
 * Global hook that watches pending transactions and updates the store
 * when they are confirmed, rejected, or failed.
 *
 * Uses dynamic detection via window focus events to detect wallet rejections
 * without relying on static timeouts.
 *
 * This should be mounted once at the app level (in Providers).
 */
export function usePendingTransactionWatcher() {
  const publicClient = usePublicClient();
  const {
    pendingTransactions,
    removePendingTransaction,
    finishCancellingGame,
    finishJoiningGame,
  } = useGameStore();

  const watchingRef = useRef<Set<string>>(new Set());
  const hadPendingBeforeBlurRef = useRef<Set<string>>(new Set());
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup pending transactions that were waiting before blur and still have no txHash
  const checkPendingAfterFocus = useCallback(() => {
    // Clear any existing timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Small delay to allow any in-flight confirmations to arrive
    focusTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;

      const currentPendingTransactions = useGameStore.getState().pendingTransactions;

      for (const key of hadPendingBeforeBlurRef.current) {
        const tx = currentPendingTransactions.get(key);

        // If this transaction was pending before blur and still has no txHash,
        // the user likely rejected it in the wallet
        if (tx && !tx.txHash) {
          const age = Date.now() - tx.startedAt;
          // Only cleanup if it's been at least 1 second (avoid race conditions)
          if (age > 1000) {
            console.log(`🧹 [TxWatcher] Removing pending tx after focus return: ${key} (age: ${age}ms)`);
            removePendingTransaction(key);
          }
        }
      }

      hadPendingBeforeBlurRef.current.clear();
      focusTimeoutRef.current = null;
    }, 300); // 300ms delay for wallet UI to settle
  }, [removePendingTransaction]);

  // Track pending transactions when window loses focus (user opening wallet)
  const handleBlur = useCallback(() => {
    const currentPendingTransactions = useGameStore.getState().pendingTransactions;
    hadPendingBeforeBlurRef.current.clear();

    for (const [key, tx] of currentPendingTransactions.entries()) {
      if (!tx.txHash) {
        hadPendingBeforeBlurRef.current.add(key);
        console.log(`👀 [TxWatcher] Tracking pending tx before blur: ${key}`);
      }
    }
  }, []);

  // Check for rejections when window regains focus
  const handleFocus = useCallback(() => {
    if (hadPendingBeforeBlurRef.current.size > 0) {
      console.log(`👀 [TxWatcher] Window focused, checking ${hadPendingBeforeBlurRef.current.size} pending txs`);
      checkPendingAfterFocus();
    }
  }, [checkPendingAfterFocus]);

  // Listen for window focus/blur events to detect wallet interactions
  useEffect(() => {
    mountedRef.current = true;
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      // Clear any pending timeout
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, [handleBlur, handleFocus]);

  // Watch transactions that have been submitted (have txHash)
  useEffect(() => {
    if (!publicClient) return;

    // Check each pending transaction
    for (const [key, tx] of pendingTransactions.entries()) {
      // Skip if no txHash yet (still awaiting wallet approval)
      if (!tx.txHash) continue;

      // Skip if already watching this transaction
      if (watchingRef.current.has(key)) continue;

      // Mark as watching
      watchingRef.current.add(key);

      console.log(`👀 [TxWatcher] Watching transaction: ${key} (${tx.txHash})`);

      // Watch the transaction
      publicClient.waitForTransactionReceipt({ hash: tx.txHash })
        .then((receipt) => {
          // Guard against unmounted component
          if (!mountedRef.current) {
            watchingRef.current.delete(key);
            return;
          }

          console.log(`✅ [TxWatcher] Transaction confirmed: ${key}`, receipt.status);

          if (receipt.status === 'success') {
            // Transaction succeeded - remove from pending
            removePendingTransaction(key);

            // Handle specific transaction types
            if (tx.type === 'cancel' && tx.gameId) {
              finishCancellingGame(tx.gameId, true);
            } else if (tx.type === 'join' && tx.gameId) {
              finishJoiningGame(tx.gameId, true);
            }
          } else {
            // Transaction failed (reverted)
            console.log(`❌ [TxWatcher] Transaction reverted: ${key}`);
            removePendingTransaction(key);

            if (tx.type === 'cancel' && tx.gameId) {
              finishCancellingGame(tx.gameId, false);
            } else if (tx.type === 'join' && tx.gameId) {
              finishJoiningGame(tx.gameId, false);
            }
          }

          // Stop watching
          watchingRef.current.delete(key);
        })
        .catch((error) => {
          // Guard against unmounted component
          if (!mountedRef.current) {
            watchingRef.current.delete(key);
            return;
          }

          console.log(`❌ [TxWatcher] Transaction error: ${key}`, error);
          // Transaction was likely rejected or replaced
          removePendingTransaction(key);

          if (tx.type === 'cancel' && tx.gameId) {
            finishCancellingGame(tx.gameId, false);
          } else if (tx.type === 'join' && tx.gameId) {
            finishJoiningGame(tx.gameId, false);
          }

          // Stop watching
          watchingRef.current.delete(key);
        });
    }

    // Cleanup stale entries from watchingRef
    for (const key of watchingRef.current) {
      if (!pendingTransactions.has(key)) {
        watchingRef.current.delete(key);
      }
    }
  }, [pendingTransactions, publicClient, removePendingTransaction, finishCancellingGame, finishJoiningGame]);

  // Fallback: Check for very stale transactions (safety net)
  // - Without txHash: 2 minutes (fallback if focus events don't fire)
  // - With txHash: 10 minutes (transaction might be pending in mempool)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const NO_HASH_FALLBACK = 2 * 60 * 1000; // 2 minutes fallback for edge cases
      const WITH_HASH_THRESHOLD = 10 * 60 * 1000; // 10 minutes with txHash

      for (const [key, tx] of pendingTransactions.entries()) {
        const age = now - tx.startedAt;

        if (!tx.txHash && age > NO_HASH_FALLBACK) {
          // No txHash after 2 minutes - fallback cleanup
          console.log(`🧹 [TxWatcher] Fallback cleanup (no hash): ${key}`);
          removePendingTransaction(key);
        } else if (tx.txHash && age > WITH_HASH_THRESHOLD) {
          // Has txHash but very old - something went wrong
          console.log(`🧹 [TxWatcher] Fallback cleanup (timeout): ${key}`);
          removePendingTransaction(key);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [pendingTransactions, removePendingTransaction]);
}
