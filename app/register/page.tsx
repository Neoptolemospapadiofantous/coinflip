'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Flex,
  Card,
  Text,
  Heading,
  Box,
  TextField,
  Separator,
  Callout,
} from '@radix-ui/themes';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Mail, Lock, Chrome, Loader2, AlertCircle, CheckCircle, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// Microsoft icon component
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const {
    signInWithGoogle,
    signInWithMicrosoft,
    signUpWithEmail,
    resendVerification,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [resending, setResending] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (authLoading || isAuthenticated) {
    return (
      <Flex align="center" justify="center" className="h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </Flex>
    );
  }

  const handleGoogleSignUp = async () => {
    setLoadingProvider('google');
    setError(null);
    const result = await signInWithGoogle();
    if (!result.success) {
      setError(result.error || 'Failed to sign up with Google');
      setLoadingProvider(null);
    }
  };

  const handleMicrosoftSignUp = async () => {
    setLoadingProvider('microsoft');
    setError(null);
    const result = await signInWithMicrosoft();
    if (!result.success) {
      setError(result.error || 'Failed to sign up with Microsoft');
      setLoadingProvider(null);
    }
  };

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pass)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pass)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pass)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate inputs
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    const result = await signUpWithEmail(email, password);

    if (result.success) {
      setEmailSent(true);
    } else {
      setError(result.error || 'Failed to create account');
    }

    setIsLoading(false);
  };

  const handleResendEmail = async () => {
    setResending(true);
    const result = await resendVerification(email);
    if (result.success) {
      setError(null);
    } else {
      setError(result.error || 'Failed to resend verification email');
    }
    setResending(false);
  };

  // Email verification sent screen
  if (emailSent) {
    return (
      <AuthLayout>
        <Card className="w-full max-w-sm">
          <Flex direction="column" gap="5" p="6" align="center">
            {/* Success Icon */}
            <Box className="p-4 rounded-full bg-green-500/20">
              <Mail className="w-8 h-8 text-green-400" />
            </Box>

            {/* Header */}
            <Flex direction="column" align="center" gap="2">
              <Heading size="5">Check Your Email</Heading>
              <Text size="2" color="gray" align="center">
                We've sent a verification link to
              </Text>
              <Text size="2" weight="medium" color="cyan">
                {email}
              </Text>
            </Flex>

            {/* Instructions */}
            <Callout.Root color="blue" size="1">
              <Callout.Icon>
                <CheckCircle className="w-4 h-4" />
              </Callout.Icon>
              <Callout.Text>
                Click the link in the email to verify your account and complete registration.
              </Callout.Text>
            </Callout.Root>

            {/* Error if resend failed */}
            {error && (
              <Flex
                align="center"
                gap="2"
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 w-full"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <Text size="2" color="red">
                  {error}
                </Text>
              </Flex>
            )}

            {/* Resend Button */}
            <Button
              size="2"
              variant="soft"
              className="cursor-pointer"
              onClick={handleResendEmail}
              disabled={resending}
            >
              {resending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Resend verification email'
              )}
            </Button>

            {/* Back to Login */}
            <Link href="/login">
              <Text size="2" color="cyan" className="cursor-pointer hover:underline">
                Back to login
              </Text>
            </Link>
          </Flex>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Flex direction="column" align="center" gap="6" className="w-full max-w-sm">
        {/* Register Card */}
        <Card className="w-full">
          <Flex direction="column" gap="5" p="6">
            {/* Header */}
            <Flex direction="column" align="center" gap="2">
              <Heading size="6">Create Account</Heading>
              <Text size="2" color="gray">
                Sign up to unlock premium features
              </Text>
            </Flex>

            {/* Error Message */}
            {error && (
              <Flex
                align="center"
                gap="2"
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <Text size="2" color="red">
                  {error}
                </Text>
              </Flex>
            )}

            {/* OAuth Buttons */}
            <Flex direction="column" gap="3">
              <Button
                size="3"
                variant="surface"
                className="cursor-pointer w-full"
                onClick={handleGoogleSignUp}
                disabled={!!loadingProvider}
              >
                {loadingProvider === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Chrome className="w-4 h-4" />
                )}
                Continue with Google
              </Button>

              <Button
                size="3"
                variant="surface"
                className="cursor-pointer w-full"
                onClick={handleMicrosoftSignUp}
                disabled={!!loadingProvider}
              >
                {loadingProvider === 'microsoft' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MicrosoftIcon className="w-4 h-4" />
                )}
                Continue with Microsoft
              </Button>
            </Flex>

            {/* Divider */}
            <Flex align="center" gap="3">
              <Separator size="4" />
              <Text size="1" color="gray" className="flex-shrink-0">
                or register with email
              </Text>
              <Separator size="4" />
            </Flex>

            {/* Email Form */}
            <form onSubmit={handleEmailSignUp}>
              <Flex direction="column" gap="3">
                <Box>
                  <Text as="label" size="2" weight="medium" className="block mb-1">
                    Email
                  </Text>
                  <TextField.Root
                    size="3"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  >
                    <TextField.Slot>
                      <Mail className="w-4 h-4 text-gray-400" />
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" className="block mb-1">
                    Password
                  </Text>
                  <TextField.Root
                    size="3"
                    placeholder="At least 8 characters"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  >
                    <TextField.Slot>
                      <Lock className="w-4 h-4 text-gray-400" />
                    </TextField.Slot>
                  </TextField.Root>
                  <Text size="1" color="gray" className="mt-1">
                    Must contain uppercase, lowercase, and number
                  </Text>
                </Box>

                <Box>
                  <Text as="label" size="2" weight="medium" className="block mb-1">
                    Confirm Password
                  </Text>
                  <TextField.Root
                    size="3"
                    placeholder="Confirm your password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  >
                    <TextField.Slot>
                      <Lock className="w-4 h-4 text-gray-400" />
                    </TextField.Slot>
                  </TextField.Root>
                </Box>

                <Button
                  size="3"
                  type="submit"
                  className="cursor-pointer w-full mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Create Account
                    </>
                  )}
                </Button>
              </Flex>
            </form>

            {/* Login Link */}
            <Flex justify="center" gap="1">
              <Text size="2" color="gray">
                Already have an account?
              </Text>
              <Link href="/login">
                <Text size="2" color="cyan" className="cursor-pointer hover:underline">
                  Sign in
                </Text>
              </Link>
            </Flex>
          </Flex>
        </Card>

        {/* Info Text */}
        <Text size="1" color="gray" align="center">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
          Your wallet can be linked after registration.
        </Text>
      </Flex>
    </AuthLayout>
  );
}
