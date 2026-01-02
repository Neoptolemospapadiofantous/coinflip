import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Auth Callback Handler
 *
 * Handles OAuth redirects from providers (Google, Microsoft)
 * and email verification links.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    );
  }

  // Exchange code for session
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Callback] Code exchange error:', exchangeError);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      );
    }
  }

  // Redirect to home page after successful auth
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
