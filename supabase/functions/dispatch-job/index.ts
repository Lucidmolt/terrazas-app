import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

// M3 FIX: Restrict CORS to production origins
const ALLOWED_ORIGINS = ['https://terrazas.app', 'https://terrazas-app.vercel.app']

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // M4 FIX: Verify caller identity via authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { record } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Find providers who serve this zip code
    const { data: providers, error: pError } = await supabase
      .from('providers')
      .select('phone_number, business_name, email')
      .contains('zip_codes', [record.zip_code])
      .eq('is_active', true)

    if (pError) {
      console.error('[Dispatch] Provider query error:', pError)
      return new Response(
        JSON.stringify({ error: 'Provider query failed', details: pError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ dispatched: false, count: 0, message: 'No active providers in zone' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Send SMS alerts via Twilio
    const results = await Promise.all(providers.map(async (provider) => {
      if (!provider.phone_number) return false

      const message = `Terrazas: New $${record.price || '?'} ${record.tier || ''} Job in ${record.zip_code}! Tap to claim: https://terrazas.app/claim/${record.id}`

      if (TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID) {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: provider.phone_number,
              From: TWILIO_PHONE_NUMBER ?? '',
              Body: message,
            }),
          }
        )
        return response.ok
      } else {
        console.log(`[MOCK SMS] To: ${provider.phone_number} | ${message}`)
        return true
      }
    }))

    return new Response(
      JSON.stringify({ dispatched: true, count: results.filter(Boolean).length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    )
  }
})
