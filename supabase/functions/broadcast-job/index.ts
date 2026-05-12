import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    const jobZip = record.zip_code
    const jobTier = record.tier || 'basic'
    const jobPrice = record.price

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Find all active Pros serving this zip code
    // Uses unified `providers` table with `zip_codes` array column
    const { data: pros, error: proError } = await supabase
      .from('providers')
      .select('phone_number, business_name, email')
      .eq('is_active', true)
      .contains('zip_codes', [jobZip])

    if (proError) throw proError

    if (!pros || pros.length === 0) {
      console.log(`[Broadcast] No active providers found in ${jobZip}`)
      return new Response(
        JSON.stringify({ success: true, notified_count: 0, message: 'No providers in zone' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Send SMS via Twilio (or log if credentials missing)
    const notifications = pros.map(async (pro) => {
      const message = `Terrazas: New ${jobTier} job in ${jobZip}! Pay: $${jobPrice}. Claim: https://terrazas-app.vercel.app/claim/${record.id}`

      if (TWILIO_AUTH_TOKEN && TWILIO_ACCOUNT_SID && pro.phone_number) {
        return fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: pro.phone_number,
              From: TWILIO_PHONE_NUMBER!,
              Body: message
            })
          }
        )
      } else {
        console.log(`[MOCK SMS] To: ${pro.phone_number || pro.email} | Msg: ${message}`)
        return Promise.resolve()
      }
    })

    await Promise.all(notifications)

    return new Response(
      JSON.stringify({ success: true, notified_count: pros.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
