import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id, pro_id, eta } = await req.json()

    if (!job_id || !pro_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'job_id and pro_id are required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // Call the atomic PostgreSQL function to handle the race condition
    const { data, error } = await supabase.rpc('claim_job', {
      p_job_id: job_id,
      p_pro_id: pro_id,
      p_eta: eta || 30,
    })

    if (error) throw error

    const result = data as { success: boolean; message: string }

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 409, // Conflict — job already claimed
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Success — log the claim
    await supabase.from('claims').insert([{
      job_id,
      provider_id: pro_id,
      eta_minutes: eta || 30,
      was_successful: true,
    }])

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
