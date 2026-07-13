import { NextResponse } from 'next/server';
import { uploadImage, UploadFolder } from '@/lib/storage';
import { requireAuth } from '@/lib/api-auth';

// Whitelist of allowed upload folders — the UploadFolder type in lib/storage.ts
// plus 'disputes' (used by the dashboard dispute flow). Anything else is rejected
// so the client can't control arbitrary storage paths.
const ALLOWED_FOLDERS: string[] = ['yards', 'logos', 'portfolio', 'completion', 'profiles', 'disputes'];

// POST /api/upload — Upload image to Supabase Storage
// Body: FormData with 'file' field and 'folder' field
export async function POST(request: Request) {
  // H5 FIX: Require authentication for uploads
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'yards';

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC' }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    const result = await uploadImage(buffer, folder as UploadFolder, sanitizedName, file.type);

    if (!result) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({
      url: result.url,
      path: result.path,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
