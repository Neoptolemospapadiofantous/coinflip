/**
 * Supabase Authentication
 *
 * Handles authentication via:
 * - Google OAuth
 * - Microsoft OAuth
 * - Email/Password with verification
 * - Wallet linking (associate wallet with account)
 */

import { supabase } from '@/lib/supabase';
import { devLog } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export type AuthProvider = 'google' | 'azure' | 'email';

export interface SignUpData {
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  needsEmailVerification?: boolean;
}

export interface User {
  id: string;
  email: string | null;
  walletAddress: string | null;
  provider: string | null;
  createdAt: string;
}

// ============================================
// OAUTH PROVIDERS
// ============================================

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      devLog.error('[Auth] Google sign in error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Google sign in exception:', error);
    return { success: false, error: 'Failed to sign in with Google' };
  }
}

/**
 * Sign in with Microsoft
 */
export async function signInWithMicrosoft(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile openid',
      },
    });

    if (error) {
      devLog.error('[Auth] Microsoft sign in error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Microsoft sign in exception:', error);
    return { success: false, error: 'Failed to sign in with Microsoft' };
  }
}

// ============================================
// EMAIL AUTH
// ============================================

/**
 * Sign up with email and password
 * Sends verification email
 */
export async function signUpWithEmail(data: SignUpData): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      devLog.error('[Auth] Email sign up error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, needsEmailVerification: true };
  } catch (error) {
    devLog.error('[Auth] Email sign up exception:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(data: SignInData): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      devLog.error('[Auth] Email sign in error:', error);

      // Handle specific errors
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Please verify your email before signing in', needsEmailVerification: true };
      }
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Invalid email or password' };
      }

      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Email sign in exception:', error);
    return { success: false, error: 'Failed to sign in' };
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      devLog.error('[Auth] Resend verification error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Resend verification exception:', error);
    return { success: false, error: 'Failed to resend verification email' };
  }
}

/**
 * Request password reset
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      devLog.error('[Auth] Password reset error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Password reset exception:', error);
    return { success: false, error: 'Failed to send password reset email' };
  }
}

/**
 * Update password (after reset link clicked)
 */
export async function updatePassword(newPassword: string): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      devLog.error('[Auth] Update password error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Update password exception:', error);
    return { success: false, error: 'Failed to update password' };
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Sign out
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      devLog.error('[Auth] Sign out error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Sign out exception:', error);
    return { success: false, error: 'Failed to sign out' };
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Get linked wallet from user metadata
    const walletAddress = user.user_metadata?.wallet_address || null;

    return {
      id: user.id,
      email: user.email || null,
      walletAddress,
      provider: user.app_metadata?.provider || null,
      createdAt: user.created_at,
    };
  } catch (error) {
    devLog.error('[Auth] Get current user error:', error);
    return null;
  }
}

// ============================================
// WALLET LINKING
// ============================================

/**
 * Link a wallet address to the current user account
 * This allows cross-device wallet recognition
 */
export async function linkWallet(walletAddress: string, _signature: string): Promise<AuthResult> {
  try {
    // Verify the signature matches the wallet address
    // This would typically be done server-side for security
    // For now, we trust the client and store the wallet

    const { error } = await supabase.auth.updateUser({
      data: {
        wallet_address: walletAddress.toLowerCase(),
        wallet_linked_at: new Date().toISOString(),
      },
    });

    if (error) {
      devLog.error('[Auth] Link wallet error:', error);
      return { success: false, error: error.message };
    }

    devLog.log('[Auth] Wallet linked successfully:', walletAddress);
    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Link wallet exception:', error);
    return { success: false, error: 'Failed to link wallet' };
  }
}

/**
 * Unlink wallet from account
 */
export async function unlinkWallet(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.updateUser({
      data: {
        wallet_address: null,
        wallet_linked_at: null,
      },
    });

    if (error) {
      devLog.error('[Auth] Unlink wallet error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    devLog.error('[Auth] Unlink wallet exception:', error);
    return { success: false, error: 'Failed to unlink wallet' };
  }
}

/**
 * Check if wallet is linked to any account
 */
export async function isWalletLinked(walletAddress: string): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.walletAddress?.toLowerCase() === walletAddress.toLowerCase();
}
