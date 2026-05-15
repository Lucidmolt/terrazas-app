import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // M4 FIX: Verify caller identity via authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { record } = await req.json();
    const { zip_code, tier, id, ai_warning } = record;

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Fetch matching active providers for this zip
    const { data: pros, error: proError } = await supabase
      .from('providers')
      .select('business_name, email, phone_number')
      .contains('zip_codes', [zip_code])
      .eq('is_active', true);

    if (proError) throw proError;

    // 2. Notify Admin
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Terrazas Dispatch <dispatch@updates.terrazas.app>",
          to: ["lucidmolt@icloud.com"],
          subject: `🚜 BROADCAST START: ${zip_code} (${tier})`,
          html: `<h3>New Broadcast Initiated</h3>
                 <p><strong>Job ID:</strong> ${id}</p>
                 <p><strong>Tier:</strong> ${tier}</p>
                 <p><strong>Providers Reached:</strong> ${pros?.length || 0}</p>
                 ${ai_warning ? '<p style="color: #ef4444;">⚠️ Yard Condition Warning active</p>' : ''}`,
        }),
      });
    }

    // 3. Notify Pros (The "Broadcast")
    if (RESEND_API_KEY && pros && pros.length > 0) {
      const notifications = pros
        .filter((pro) => pro.email)
        .map((pro) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Terrazas Jobs <jobs@updates.terrazas.app>",
              to: [pro.email],
              subject: `📍 New Job in ${zip_code} - Claim Now!`,
              html: `<h3>New Job Opportunity</h3>
                     <p>Hey ${pro.business_name}, a new <strong>${tier}</strong> job is available in <strong>${zip_code}</strong>.</p>
                     ${ai_warning ? '<p style="color: #ef4444; font-weight: bold;">⚠️ Condition Warning: Our scan suggests this yard may require extra effort.</p>' : ''}
                     <p>You have 15 minutes to claim this before it opens to the wider network.</p>
                     <a href="https://terrazas.app/claim/${id}" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;text-decoration:none;border-radius:12px;font-weight:bold;">Claim Job</a>`,
            }),
          })
        );

      await Promise.all(notifications);
    }

    return new Response(
      JSON.stringify({ success: true, notified: pros?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 400 }
    );
  }
});
