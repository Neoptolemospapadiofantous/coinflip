'use client';

/**
 * Authentication Hook
 *
 * Provides authentication state and methods for components.
 * Integrates Supabase Auth with wallet connection.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  signInWithGoogle,
  signInWithMicrosoft,
  signInWithEmail,
  signUpWithEmail,
  signOut as authSignOut,
  linkWallet,
  unlinkWallet,
  getCurrentUser,
  resetPassword,
  resendVerificationEmail,
  type AuthResult,
  type User,
} from '@/lib/auth/supabase-auth';
import { devLog } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface AuthState {
  // Session state
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Wallet state
  walletAddress: string | undefined;
  isWalletConnected: boolean;
  isWalletLinked: boolean;

  // Auth methods
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithMicrosoft: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;

  // Wallet linking
  linkCurrentWallet: () => Promise<AuthResult>;
  unlinkWallet: () => Promise<AuthResult>;
}

// ============================================
// HOOK
// ============================================

export function useAuth(): AuthState {
  // Supabase session state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wallet state
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  // Load initial session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);

        if (session) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        devLog.error('[useAuth] Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== 'INITIAL_SESSION') devLog.log('[useAuth] Auth state changed:', event);
        setSession(session);

        if (session) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // AUTH METHODS
  // ============================================

  const handleSignInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    return signInWithGoogle();
  }, []);

  const handleSignInWithMicrosoft = useCallback(async (): Promise<AuthResult> => {
    return signInWithMicrosoft();
  }, []);

  const handleSignInWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await signInWithEmail({ email, password });
    if (result.success) {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }
    return result;
  }, []);

  const handleSignUpWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    return signUpWithEmail({ email, password });
  }, []);

  const handleSignOut = useCallback(async (): Promise<AuthResult> => {
    const result = await authSignOut();
    if (result.success) {
      setSession(null);
      setUser(null);
    }
    return result;
  }, []);

  const handleResetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    return resetPassword(email);
  }, []);

  const handleResendVerification = useCallback(async (email: string): Promise<AuthResult> => {
    return resendVerificationEmail(email);
  }, []);

  // ============================================
  // WALLET LINKING
  // ============================================

  const linkCurrentWallet = useCallback(async (): Promise<AuthResult> => {
    if (!walletAddress) {
      return { success: false, error: 'No wallet connected' };
    }

    if (!session) {
      return { success: false, error: 'Please sign in first' };
    }

    try {
      // Sign a message to prove wallet ownership
      const message = `Link wallet to CoinFlip account\n\nAccount: ${session.user.email}\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;

      const signature = await signMessageAsync({ message });

      const result = await linkWallet(walletAddress, signature);

      if (result.success) {
        // Refresh user data
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      }

      return result;
    } catch (error) {
      devLog.error('[useAuth] Wallet linking error:', error);

      // User rejected signature
      if ((error as Error).message?.includes('rejected')) {
        return { success: false, error: 'Signature rejected' };
      }

      return { success: false, error: 'Failed to link wallet' };
    }
  }, [walletAddress, session, signMessageAsync]);

  const handleUnlinkWallet = useCallback(async (): Promise<AuthResult> => {
    const result = await unlinkWallet();

    if (result.success) {
      // Refresh user data
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    }

    return result;
  }, []);

  // ============================================
  // COMPUTED STATE
  // ============================================

  const isAuthenticated = !!session?.user;
  const isWalletLinked = !!user?.walletAddress &&
    user.walletAddress.toLowerCase() === walletAddress?.toLowerCase();

  return {
    // Session state
    session,
    user,
    isLoading,
    isAuthenticated,

    // Wallet state
    walletAddress,
    isWalletConnected,
    isWalletLinked,

    // Auth methods
    signInWithGoogle: handleSignInWithGoogle,
    signInWithMicrosoft: handleSignInWithMicrosoft,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    resendVerification: handleResendVerification,

    // Wallet linking
    linkCurrentWallet,
    unlinkWallet: handleUnlinkWallet,
  };
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Simple hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Get current user data
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}
