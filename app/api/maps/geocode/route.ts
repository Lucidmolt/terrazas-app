import { NextResponse } from 'next/server';
import { geocodeAddress, reverseGeocode, autocompleteAddress, getPlaceDetails, isMapsConfigured } from '@/lib/google-maps';

// GET /api/maps/geocode?address=...  → geocode
// GET /api/maps/geocode?lat=...&lng=...  → reverse geocode
// GET /api/maps/geocode?q=...  → autocomplete
// GET /api/maps/geocode?placeId=...  → place details
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const address = searchParams.get('address');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const q = searchParams.get('q');
  const placeId = searchParams.get('placeId');

  try {
    // Autocomplete
    if (q) {
      const results = await autocompleteAddress(q);
      return NextResponse.json({ results, configured: isMapsConfigured() });
    }

    // Place details
    if (placeId) {
      const result = await getPlaceDetails(placeId);
      if (!result) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    // Reverse geocode
    if (lat && lng) {
      const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
      if (!result) return NextResponse.json({ error: 'Location not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    // Forward geocode
    if (address) {
      const result = await geocodeAddress(address);
      if (!result) return NextResponse.json({ error: 'Address not found' }, { status: 404 });
      return NextResponse.json(result);
    }

    // Health check
    return NextResponse.json({
      configured: isMapsConfigured(),
      services: ['geocode', 'reverse', 'autocomplete', 'placeDetails'],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
