// ── Google Maps Service Layer ───────────────────────────────────────
// Centralizes all Google Maps API interactions:
//   • Geocoding (address → lat/lng)
//   • Reverse geocoding (lat/lng → address)
//   • Distance Matrix (real ETAs between provider & customer)
//   • Place Autocomplete (address suggestions)
//   • Static Maps (thumbnail images for job cards)
//
// Requires: GOOGLE_MAPS_API_KEY in .env.local
// Enable these APIs in Google Cloud Console:
//   - Maps JavaScript API
//   - Places API (New)
//   - Geocoding API
//   - Distance Matrix API

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const GEO_BASE = 'https://maps.googleapis.com/maps/api/geocode';
const DISTANCE_BASE = 'https://maps.googleapis.com/maps/api/distancematrix';

// ── Types ──────────────────────────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  address: string;
  lat: number;
  lng: number;
  placeId: string;
  zipCode: string;
  city: string;
  state: string;
}

export interface AutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface DistanceResult {
  distanceMiles: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
}

// ── Geocode Address → Coordinates ──────────────────────────────────
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!API_KEY) {
    console.warn('[Maps] No GOOGLE_MAPS_API_KEY set — using mock geocoding');
    return mockGeocode(address);
  }

  try {
    const res = await fetch(
      `${GEO_BASE}/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      console.error('[Maps] Geocoding failed:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];

    return {
      address: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      placeId: result.place_id,
      zipCode: components.find((c: any) => c.types.includes('postal_code'))?.short_name || '',
      city: components.find((c: any) => c.types.includes('locality'))?.long_name || '',
      state: components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '',
    };
  } catch (error) {
    console.error('[Maps] Geocoding error:', error);
    return null;
  }
}

// ── Reverse Geocode (lat/lng → address) ────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  if (!API_KEY) {
    return mockReverseGeocode(lat, lng);
  }

  try {
    const res = await fetch(
      `${GEO_BASE}/json?latlng=${lat},${lng}&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) return null;

    const result = data.results[0];
    const components = result.address_components || [];

    return {
      address: result.formatted_address,
      lat, lng,
      placeId: result.place_id,
      zipCode: components.find((c: any) => c.types.includes('postal_code'))?.short_name || '',
      city: components.find((c: any) => c.types.includes('locality'))?.long_name || '',
      state: components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '',
    };
  } catch (error) {
    console.error('[Maps] Reverse geocode error:', error);
    return null;
  }
}

// ── Place Autocomplete ─────────────────────────────────────────────
export async function autocompleteAddress(
  input: string,
  sessionToken?: string
): Promise<AutocompleteResult[]> {
  if (!API_KEY || input.length < 3) return [];

  try {
    const params = new URLSearchParams({
      input,
      types: 'address',
      components: 'country:us',
      key: API_KEY,
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);

    const res = await fetch(`${PLACES_BASE}/autocomplete/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK') return [];

    return data.predictions.map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));
  } catch (error) {
    console.error('[Maps] Autocomplete error:', error);
    return [];
  }
}

// ── Get Place Details (placeId → full address + lat/lng) ───────────
export async function getPlaceDetails(placeId: string): Promise<GeocodingResult | null> {
  if (!API_KEY) return null;

  try {
    const res = await fetch(
      `${PLACES_BASE}/details/json?place_id=${placeId}&fields=geometry,formatted_address,address_components&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.status !== 'OK') return null;

    const r = data.result;
    const components = r.address_components || [];

    return {
      address: r.formatted_address,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      placeId,
      zipCode: components.find((c: any) => c.types.includes('postal_code'))?.short_name || '',
      city: components.find((c: any) => c.types.includes('locality'))?.long_name || '',
      state: components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '',
    };
  } catch (error) {
    console.error('[Maps] Place details error:', error);
    return null;
  }
}

// ── Distance Matrix (real ETAs) ────────────────────────────────────
export async function getDistance(
  origin: LatLng,
  destination: LatLng
): Promise<DistanceResult | null> {
  if (!API_KEY) {
    return mockDistance(origin, destination);
  }

  try {
    const res = await fetch(
      `${DISTANCE_BASE}/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&units=imperial&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.status !== 'OK') return null;

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') return null;

    return {
      distanceMiles: Math.round((element.distance.value / 1609.34) * 10) / 10,
      distanceText: element.distance.text,
      durationMinutes: Math.ceil(element.duration.value / 60),
      durationText: element.duration.text,
    };
  } catch (error) {
    console.error('[Maps] Distance matrix error:', error);
    return null;
  }
}

// ── Batch Distance (one customer → multiple providers) ─────────────
export async function getBatchDistances(
  customerLocation: LatLng,
  providerLocations: { id: string; lat: number; lng: number }[]
): Promise<Map<string, DistanceResult>> {
  const results = new Map<string, DistanceResult>();

  if (!API_KEY || providerLocations.length === 0) {
    // Mock: return haversine estimates
    for (const p of providerLocations) {
      const dist = haversineDistance(customerLocation, { lat: p.lat, lng: p.lng });
      results.set(p.id, {
        distanceMiles: Math.round(dist * 10) / 10,
        distanceText: `${Math.round(dist)} mi`,
        durationMinutes: Math.ceil(dist * 2.5), // rough ~24mph average
        durationText: `${Math.ceil(dist * 2.5)} mins`,
      });
    }
    return results;
  }

  try {
    const destinations = providerLocations.map(p => `${p.lat},${p.lng}`).join('|');
    const res = await fetch(
      `${DISTANCE_BASE}/json?origins=${customerLocation.lat},${customerLocation.lng}&destinations=${destinations}&units=imperial&key=${API_KEY}`
    );
    const data = await res.json();

    if (data.status === 'OK' && data.rows?.[0]?.elements) {
      data.rows[0].elements.forEach((el: any, i: number) => {
        if (el.status === 'OK') {
          results.set(providerLocations[i].id, {
            distanceMiles: Math.round((el.distance.value / 1609.34) * 10) / 10,
            distanceText: el.distance.text,
            durationMinutes: Math.ceil(el.duration.value / 60),
            durationText: el.duration.text,
          });
        }
      });
    }
  } catch (error) {
    console.error('[Maps] Batch distance error:', error);
  }

  return results;
}

// ── Static Map URL (for job cards / previews) ──────────────────────
export function getStaticMapUrl(
  lat: number,
  lng: number,
  opts: { width?: number; height?: number; zoom?: number; marker?: boolean } = {}
): string {
  const { width = 600, height = 300, zoom = 15, marker = true } = opts;

  if (!API_KEY) {
    // Fallback to OpenStreetMap static tiles (no key needed)
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik${marker ? `&markers=${lat},${lng},red-pushpin` : ''}`;
  }

  const markers = marker ? `&markers=color:0x059669|${lat},${lng}` : '';
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&maptype=roadmap&style=feature:poi|visibility:off${markers}&key=${API_KEY}`;
}

// ── Haversine Distance (fallback when no API key) ──────────────────
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinHalf = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(sinHalf), Math.sqrt(1 - sinHalf));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ── Check if API key is configured ─────────────────────────────────
export function isMapsConfigured(): boolean {
  return !!API_KEY;
}

// ── Mock Functions (for dev without API key) ───────────────────────
// Defaults to Liberal, KS launch zone
function mockGeocode(address: string): GeocodingResult {
  const zip = address.match(/\d{5}/)?.[0] || '67901';
  return {
    address: address || '412 N Kansas Ave, Liberal, KS 67901',
    lat: 37.0439 + (Math.random() - 0.5) * 0.02,
    lng: -100.9210 + (Math.random() - 0.5) * 0.02,
    placeId: `mock_place_${zip}`,
    zipCode: zip,
    city: 'Liberal',
    state: 'KS',
  };
}

function mockReverseGeocode(lat: number, lng: number): GeocodingResult {
  return {
    address: `${Math.abs(lat).toFixed(4)}°N, ${Math.abs(lng).toFixed(4)}°W`,
    lat, lng,
    placeId: `mock_reverse_${lat}_${lng}`,
    zipCode: '67901',
    city: 'Liberal',
    state: 'KS',
  };
}

function mockDistance(origin: LatLng, dest: LatLng): DistanceResult {
  const miles = haversineDistance(origin, dest);
  return {
    distanceMiles: Math.round(miles * 10) / 10,
    distanceText: `${Math.round(miles)} mi`,
    durationMinutes: Math.ceil(miles * 2.5),
    durationText: `${Math.ceil(miles * 2.5)} mins`,
  };
}
