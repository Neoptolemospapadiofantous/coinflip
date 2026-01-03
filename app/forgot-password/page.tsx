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
  Callout,
} from '@radix-ui/themes';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Mail, Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPassword, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email) {
      setError('Please enter your email address');
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

    const result = await resetPassword(email);

    if (result.success) {
      setEmailSent(true);
    } else {
      setError(result.error || 'Failed to send reset email');
    }

    setIsLoading(false);
  };

  // Email sent confirmation screen
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
                We've sent a password reset link to
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
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </Callout.Text>
            </Callout.Root>

            {/* Back to Login */}
            <Link href="/login">
              <Button size="3" variant="soft" className="cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Button>
            </Link>
          </Flex>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Flex direction="column" align="center" gap="6" className="w-full max-w-sm">
        {/* Reset Card */}
        <Card className="w-full">
          <Flex direction="column" gap="5" p="6">
            {/* Header */}
            <Flex direction="column" align="center" gap="2">
              <Heading size="6">Reset Password</Heading>
              <Text size="2" color="gray" align="center">
                Enter your email and we'll send you a link to reset your password
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

            {/* Reset Form */}
            <form onSubmit={handleSubmit}>
              <Flex direction="column" gap="4">
                <Box>
                  <Text as="label" size="2" weight="medium" className="block mb-1">
                    Email Address
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

                <Button
                  size="3"
                  type="submit"
                  className="cursor-pointer w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </Flex>
            </form>

            {/* Login Link */}
            <Flex justify="center" gap="1">
              <Text size="2" color="gray">
                Remember your password?
              </Text>
              <Link href="/login">
                <Text size="2" color="cyan" className="cursor-pointer hover:underline">
                  Sign in
                </Text>
              </Link>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </AuthLayout>
  );
}
