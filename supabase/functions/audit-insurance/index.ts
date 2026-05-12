import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const LOCAL_AUDITOR_URL = Deno.env.get("LOCAL_AUDITOR_URL") // Tailscale IP of Mac Studio
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

serve(async (req) => {
  try {
    const { pro_id, file_path } = await req.json()

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Generate a Time-Limited Signed URL (5 minutes)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('insurance-documents')
      .createSignedUrl(file_path, 300)

    if (urlError) throw urlError

    // 2. Send to Local Mac Studio for AI Audit
    // This uses the private Tailscale tunnel
    const auditResponse = await fetch(`${LOCAL_AUDITOR_URL}/v1/audit-coi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: urlData.signedUrl,
        pro_id: pro_id
      })
    })

    const auditResult = await auditResponse.json()

    // 3. Update Pro Profile with Audit Results
    const { error: updateError } = await supabase
      .from('pro_profiles')
      .update({
        insurance_status: auditResult.status, // 'verified' or 'flagged'
        risk_tier: auditResult.suggested_tier,
        insurance_expiry: auditResult.expiry_date,
        insurance_data: auditResult.metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', pro_id)

    if (updateError) throw updateError

    // 4. Trigger Twilio SMS (Deferred/Async)
    // TODO: Connect to Twilio once credentials are ready
    console.log(`Audit complete for Pro ${pro_id}. Status: ${auditResult.status}`)

    return new Response(JSON.stringify({ success: true, tier: auditResult.suggested_tier }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
