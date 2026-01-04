import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Use Resend's test address if no verified domain is set
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'CoinFlip <onboarding@resend.dev>'

interface GameEmailPayload {
  type: 'matched' | 'resolved'
  game_id: number
  player_address: string
  opponent_address?: string
  amount: string
  winner_address?: string
  player_choice?: boolean
  result?: boolean
}

interface UserPreferences {
  email_notifications_enabled: boolean
  email_on_game_matched: boolean
  email_on_game_resolved: boolean
}

serve(async (req) => {
  try {
    const payload: GameEmailPayload = await req.json()
    console.log('Received payload:', payload)

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Get user preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('email_notifications_enabled, email_on_game_matched, email_on_game_resolved')
      .eq('user_address', payload.player_address.toLowerCase())
      .single()

    if (prefsError || !prefs) {
      console.log('No preferences found or email disabled for:', payload.player_address)
      return new Response(JSON.stringify({ message: 'Email notifications disabled or no preferences' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const preferences = prefs as UserPreferences

    // Check if notifications are enabled
    if (!preferences.email_notifications_enabled) {
      console.log('Email notifications disabled for:', payload.player_address)
      return new Response(JSON.stringify({ message: 'Email notifications disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check specific notification type
    if (payload.type === 'matched' && !preferences.email_on_game_matched) {
      console.log('Game matched emails disabled for:', payload.player_address)
      return new Response(JSON.stringify({ message: 'Game matched emails disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (payload.type === 'resolved' && !preferences.email_on_game_resolved) {
      console.log('Game resolved emails disabled for:', payload.player_address)
      return new Response(JSON.stringify({ message: 'Game resolved emails disabled' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get user email from auth.users via linked wallet in user metadata
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('Error listing users:', usersError)
      return new Response(JSON.stringify({ error: 'Failed to list users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Find user with matching wallet address in metadata
    const user = users.find(u =>
      u.user_metadata?.wallet_address?.toLowerCase() === payload.player_address.toLowerCase()
    )

    if (!user?.email) {
      console.log('No user found with linked wallet:', payload.player_address)
      return new Response(JSON.stringify({ message: 'No linked user found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Format amount
    const amountEth = (parseFloat(payload.amount) / 1e18).toFixed(4)
    const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

    // Build email content
    let subject: string
    let htmlContent: string

    if (payload.type === 'matched') {
      subject = `Game #${payload.game_id} Matched!`
      htmlContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; border-radius: 16px;">
          <h1 style="color: #22d3ee; margin-bottom: 24px;">Game Matched!</h1>
          <p style="font-size: 16px; line-height: 1.6;">
            Your game <strong style="color: #22d3ee;">#${payload.game_id}</strong> has been matched!
          </p>
          <div style="background: rgba(34, 211, 238, 0.1); border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Amount:</strong> ${amountEth} ETH</p>
            <p style="margin: 8px 0;"><strong>Opponent:</strong> ${shortAddress(payload.opponent_address || '')}</p>
          </div>
          <p style="font-size: 14px; color: #94a3b8;">
            The coin flip will be resolved shortly. Good luck!
          </p>
          <a href="https://coinflip.game/queue" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #a855f7 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; font-weight: 600;">
            View Game
          </a>
        </div>
      `
    } else {
      const isWinner = payload.winner_address?.toLowerCase() === payload.player_address.toLowerCase()
      const resultEmoji = isWinner ? '🎉' : '😔'
      const resultText = isWinner ? 'You Won!' : 'You Lost'
      const resultColor = isWinner ? '#22c55e' : '#ef4444'
      const coinResult = payload.result ? 'Tails' : 'Heads'
      const playerChoice = payload.player_choice ? 'Tails' : 'Heads'

      subject = `Game #${payload.game_id} Result: ${resultText}`
      htmlContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; border-radius: 16px;">
          <h1 style="color: ${resultColor}; margin-bottom: 24px;">${resultEmoji} ${resultText}</h1>
          <p style="font-size: 16px; line-height: 1.6;">
            Game <strong style="color: #22d3ee;">#${payload.game_id}</strong> has been resolved.
          </p>
          <div style="background: rgba(${isWinner ? '34, 197, 94' : '239, 68, 68'}, 0.1); border: 1px solid rgba(${isWinner ? '34, 197, 94' : '239, 68, 68'}, 0.3); border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 8px 0;"><strong>Amount:</strong> ${amountEth} ETH</p>
            <p style="margin: 8px 0;"><strong>Your Choice:</strong> ${playerChoice}</p>
            <p style="margin: 8px 0;"><strong>Result:</strong> ${coinResult}</p>
            <p style="margin: 8px 0; font-size: 18px; color: ${resultColor};">
              <strong>${isWinner ? `+${(parseFloat(amountEth) * 2 * 0.97).toFixed(4)} ETH` : `-${amountEth} ETH`}</strong>
            </p>
          </div>
          <a href="https://coinflip.game/history" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #a855f7 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px; font-weight: 600;">
            View History
          </a>
        </div>
      `
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: user.email,
        subject,
        html: htmlContent,
      }),
    })

    const emailResult = await emailResponse.json()
    console.log('Email sent:', emailResult)

    return new Response(JSON.stringify({ success: true, result: emailResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
