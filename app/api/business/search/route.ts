import { NextResponse } from 'next/server';
import { searchBusiness, getBusinessProfile, getPlacePhotoUrl } from '@/lib/google-maps';

// GET /api/business/search?q=martinez+lawn&zip=67901
// Search Google for a business by name
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const zip = searchParams.get('zip') || undefined;

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query (q) must be at least 2 characters' }, { status: 400 });
  }

  try {
    const results = await searchBusiness(query, zip);

    return NextResponse.json({
      results,
      count: results.length,
      query,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/business/search — Get full business profile by placeId
// Returns everything needed to pre-fill provider onboarding
export async function POST(request: Request) {
  try {
    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    const profile = await getBusinessProfile(placeId);
    if (!profile) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Convert photo names to displayable URLs
    const photoUrls = profile.photoNames.map((name) =>
      getPlacePhotoUrl(name, 800)
    );

    return NextResponse.json({
      profile: {
        ...profile,
        photoUrls, // Ready-to-display photo URLs
      },
      // Pre-filled fields for onboarding form
      prefill: {
        businessName: profile.name,
        phone: profile.phone,
        email: '', // Not available from Google
        address: profile.address,
        zipCode: profile.zipCode,
        city: profile.city,
        state: profile.state,
        latitude: profile.lat,
        longitude: profile.lng,
        googlePlaceId: profile.placeId,
        rating: profile.rating,
        reviewCount: profile.reviewCount,
        // Portfolio pre-fill from Google photos
        portfolioPhotos: photoUrls.slice(0, 6),
        // Auto-generate bio from Google data
        suggestedBio: generateBioSuggestion(profile),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Generate a bio suggestion from Google Business data
function generateBioSuggestion(profile: {
  name: string;
  rating: number;
  reviewCount: number;
  address: string;
  city: string;
  state: string;
}): string {
  const parts: string[] = [];

  parts.push(`${profile.name} is a professional lawn care service`);

  if (profile.city && profile.state) {
    parts.push(`based in ${profile.city}, ${profile.state}`);
  }

  if (profile.rating > 0 && profile.reviewCount > 0) {
    parts.push(`with a ${profile.rating}-star rating from ${profile.reviewCount} Google reviews`);
  }

  return parts.join(' ') + '. We take pride in delivering quality work on every job.';
}
