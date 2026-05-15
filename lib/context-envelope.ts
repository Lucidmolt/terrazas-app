// ── Sovereign Context Envelope ──────────────────────────────────────
// System 3 of the Antigravity State Fabric.
// Controls what job data is visible based on the viewer's relationship to the job.
//
// broadcast_view: All providers see this — sensitive data redacted
// claimed_view:   Only the claiming provider sees full context
// customer_view:  The customer always sees their own data
// admin_view:     Admin sees everything

export type ViewLevel = 'broadcast' | 'claimed' | 'customer' | 'admin';

interface JobData {
  id: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  customerNotes?: string | null;
  customer?: { id: string; name?: string | null; email?: string | null; phone?: string | null } | null;
  providerId?: string | null;
  status?: string;
  [key: string]: any;
}

// ── Obfuscate Address to Block Level ────────────────────────────────
// "412 N Kansas Ave, Liberal, KS 67901" → "400 block of N Kansas Ave, Liberal, KS"
export function obfuscateAddress(address: string): string {
  if (!address) return '';

  // Try to extract and round the street number to the nearest 100
  const match = address.match(/^(\d+)\s+(.+)/);
  if (match) {
    const streetNum = parseInt(match[1], 10);
    const roundedBlock = Math.floor(streetNum / 100) * 100;
    const rest = match[2];

    // Remove zip code from the visible portion
    const withoutZip = rest.replace(/\b\d{5}(-\d{4})?\b/, '').replace(/,\s*$/, '').trim();
    return `${roundedBlock} block of ${withoutZip}`;
  }

  // If no street number, just remove the zip
  return address.replace(/\b\d{5}(-\d{4})?\b/, '').replace(/,\s*$/, '').trim();
}

// ── Obfuscate Coordinates ───────────────────────────────────────────
// Adds ~200m of random noise so the pin is in the right area but not exact
export function obfuscateCoordinates(lat: number | null, lng: number | null): { lat: number | null; lng: number | null } {
  if (lat === null || lng === null) return { lat: null, lng: null };

  // ~0.002 degrees ≈ 200m of noise
  const noise = 0.002;
  return {
    lat: Math.round((lat + (Math.random() - 0.5) * noise) * 1000) / 1000,
    lng: Math.round((lng + (Math.random() - 0.5) * noise) * 1000) / 1000,
  };
}

// ── Apply Context Envelope ──────────────────────────────────────────
// Masks a job object based on the viewer's access level.
export function applyContextEnvelope(job: JobData, viewLevel: ViewLevel): JobData {
  // Admin and customer see everything
  if (viewLevel === 'admin' || viewLevel === 'customer') {
    return job;
  }

  // Claimed provider sees full context
  if (viewLevel === 'claimed') {
    return job;
  }

  // ── Broadcast view: redact sensitive data ──
  const masked = { ...job };

  // Obfuscate address to block level
  if (masked.address) {
    masked.address = obfuscateAddress(masked.address);
  }

  // Obfuscate coordinates (~200m noise)
  if (masked.latitude !== null && masked.longitude !== null) {
    const noisy = obfuscateCoordinates(masked.latitude ?? null, masked.longitude ?? null);
    masked.latitude = noisy.lat;
    masked.longitude = noisy.lng;
  }

  // Redact exact placeId
  masked.placeId = null;

  // Redact customer notes (may contain gate codes, entry instructions)
  masked.customerNotes = masked.customerNotes ? '[Visible after claiming]' : null;

  // Redact customer contact info
  if (masked.customer) {
    masked.customer = {
      id: masked.customer.id,
      name: masked.customer.name ? masked.customer.name.split(' ')[0] : null, // First name only
    };
  }

  return masked;
}

// ── Determine View Level ────────────────────────────────────────────
// Determines what level of data a viewer should see based on their ID and role.
export function determineViewLevel(
  job: JobData,
  viewerId: string | null,
  viewerRole: string
): ViewLevel {
  if (viewerRole === 'admin') return 'admin';

  // Customer viewing their own job
  if (viewerId && job.customerId === viewerId) return 'customer';

  // Provider who claimed the job
  if (viewerId && job.providerId === viewerId) return 'claimed';

  // Everyone else (browsing providers)
  return 'broadcast';
}

// ── Mask an Array of Jobs ───────────────────────────────────────────
// Convenience wrapper for masking a list of jobs for a specific viewer.
export function maskJobsForViewer(
  jobs: JobData[],
  viewerId: string | null,
  viewerRole: string
): JobData[] {
  return jobs.map(job => {
    const level = determineViewLevel(job, viewerId, viewerRole);
    return applyContextEnvelope(job, level);
  });
}
