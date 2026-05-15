import { NextResponse } from 'next/server';

// GET /api/geo/reverse?lat=37.0439&lng=-100.921
// Server-side reverse geocoding — keeps API key off the client.
// Returns the zip code for a given lat/lng coordinate.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  // Use server-side key (never exposed to browser)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Geocoding not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    const data = await res.json();

    if (!data.results?.length) {
      return NextResponse.json({ zip: null });
    }

    // Find postal_code component
    for (const result of data.results) {
      const zipComponent = result.address_components?.find(
        (c: any) => c.types?.includes('postal_code')
      );
      if (zipComponent) {
        return NextResponse.json({ zip: zipComponent.short_name });
      }
    }

    return NextResponse.json({ zip: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
