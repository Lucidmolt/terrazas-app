// ── Supabase Storage Layer ──────────────────────────────────────────
// Handles all image uploads: yard photos, provider logos, portfolio, completion photos
// Uses Supabase Storage with public bucket for easy URL access

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // H1 FIX: Fail-closed — require service role key, never fall back to anon key
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('[Storage] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for storage operations.');
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
  return _supabase;
}

const BUCKET = 'terrazas-uploads';

export type UploadFolder = 'yards' | 'logos' | 'portfolio' | 'completion' | 'profiles';

// ── Upload Image ──────────────────────────────────────────────────
export async function uploadImage(
  file: Buffer | Uint8Array,
  folder: UploadFolder,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<{ url: string; path: string } | null> {
  try {
    const path = `${folder}/${Date.now()}_${fileName}`;

    const { data, error } = await getSupabase().storage
      .from(BUCKET)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('[Storage] Upload error:', error);
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        await ensureBucket();
        // Retry
        const retry = await getSupabase().storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
        if (retry.error) {
          console.error('[Storage] Retry failed:', retry.error);
          return null;
        }
        const { data: urlData } = getSupabase().storage.from(BUCKET).getPublicUrl(retry.data.path);
        return { url: urlData.publicUrl, path: retry.data.path };
      }
      return null;
    }

    const { data: urlData } = getSupabase().storage.from(BUCKET).getPublicUrl(data.path);
    return { url: urlData.publicUrl, path: data.path };
  } catch (error) {
    console.error('[Storage] Upload exception:', error);
    return null;
  }
}

// ── Delete Image ──────────────────────────────────────────────────
export async function deleteImage(path: string): Promise<boolean> {
  try {
    const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

// ── Ensure Bucket Exists ──────────────────────────────────────────
async function ensureBucket() {
  try {
    const { error } = await getSupabase().storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB max
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    });
    if (error && !error.message?.includes('already exists')) {
      console.error('[Storage] Bucket creation error:', error);
    }
  } catch (e) {
    console.error('[Storage] Bucket error:', e);
  }
}

// ── Get Public URL ────────────────────────────────────────────────
export function getPublicUrl(path: string): string {
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
