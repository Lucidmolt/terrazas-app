import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

/**
 * CUSTOMER ONBOARDING (Magic Link)
 * No password, no friction. Just an email.
 */
export async function signInCustomer(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://terrazas.app/dashboard',
    },
  })
  return { error }
}

/**
 * PRO ONBOARDING (Phone OTP)
 * Fast, mobile-first login for crews in the field.
 */
export async function signInPro(phone) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
  })
  return { error }
}

export async function verifyProCode(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })
  return { data, error }
}
