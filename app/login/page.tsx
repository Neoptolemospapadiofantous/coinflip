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
  Container,
  Section,
  Box,
  TextField,
  Separator,
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import { Mail, Lock, Chrome, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/lib/toast';

// Microsoft icon component
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const {
    signInWithGoogle,
    signInWithMicrosoft,
    signInWithEmail,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

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

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google');
    setError(null);
    const result = await signInWithGoogle();
    if (!result.success) {
      setError(result.error || 'Failed to sign in with Google');
      setLoadingProvider(null);
    }
    // Don't reset loading - page will redirect
  };

  const handleMicrosoftSignIn = async () => {
    setLoadingProvider('microsoft');
    setError(null);
    const result = await signInWithMicrosoft();
    if (!result.success) {
      setError(result.error || 'Failed to sign in with Microsoft');
      setLoadingProvider(null);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please enter email and password');
      setIsLoading(false);
      return;
    }

    const result = await signInWithEmail(email, password);

    if (result.success) {
      showToast.success('Welcome back!');
      router.push('/');
    } else {
      if (result.needsEmailVerification) {
        setError('Please verify your email before signing in. Check your inbox.');
      } else {
        setError(result.error || 'Failed to sign in');
      }
    }

    setIsLoading(false);
  };

  return (
    <Layout>
      <Section size="3" style={{ flex: 1 }}>
        <Container size="1">
          <Flex direction="column" align="center" gap="6" py="9">
            {/* Back Button */}
            <Flex className="w-full max-w-sm">
              <Link href="/">
                <Button variant="ghost" size="2" className="cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
            </Flex>

            {/* Login Card */}
            <Card className="w-full max-w-sm">
              <Flex direction="column" gap="5" p="6">
                {/* Header */}
                <Flex direction="column" align="center" gap="2">
                  <Heading size="6">Welcome Back</Heading>
                  <Text size="2" color="gray">
                    Sign in to access premium features
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
                    onClick={handleGoogleSignIn}
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
                    onClick={handleMicrosoftSignIn}
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
                    or continue with email
                  </Text>
                  <Separator size="4" />
                </Flex>

                {/* Email Form */}
                <form onSubmit={handleEmailSignIn}>
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
                      <Flex justify="between" align="center" className="mb-1">
                        <Text as="label" size="2" weight="medium">
                          Password
                        </Text>
                        <Link href="/forgot-password">
                          <Text size="1" color="cyan" className="cursor-pointer hover:underline">
                            Forgot password?
                          </Text>
                        </Link>
                      </Flex>
                      <TextField.Root
                        size="3"
                        placeholder="Enter your password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                        'Sign In'
                      )}
                    </Button>
                  </Flex>
                </form>

                {/* Register Link */}
                <Flex justify="center" gap="1">
                  <Text size="2" color="gray">
                    Don't have an account?
                  </Text>
                  <Link href="/register">
                    <Text size="2" color="cyan" className="cursor-pointer hover:underline">
                      Sign up
                    </Text>
                  </Link>
                </Flex>
              </Flex>
            </Card>

            {/* Info Text */}
            <Text size="1" color="gray" align="center" className="max-w-sm">
              By signing in, you agree to our Terms of Service and Privacy Policy.
              Your wallet can be linked after login.
            </Text>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}
