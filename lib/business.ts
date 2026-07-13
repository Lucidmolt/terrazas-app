// ── Single-Business Mode Configuration ──────────────────────────────
// The app currently runs as the booking site for ONE business:
// Terrazas Lawn Care & Tree Service (Liberal, KS).
//
// Everything business-specific lives here so a future multi-tenant /
// marketplace mode can swap this out. This file is imported by client
// components — keep it free of server-only imports (no db, no env secrets).

// Canonical app URL used in email links, Stripe redirects, etc.
// Set NEXT_PUBLIC_APP_URL when the production domain changes.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://terrazas-app.vercel.app'

export const BUSINESS = {
  name: 'Terrazas Lawn Care & Tree Service',
  shortName: 'Terrazas',
  tagline: 'Your go-to property maintenance professionals in Southwest Kansas',
  phone: '575-574-2908',
  phoneHref: 'tel:+15755742908',
  email: 'terrazaslawncare@gmail.com',
  city: 'Liberal, KS',
  yearsInBusiness: '15+',
  // The login email of the account that owns the Provider record.
  // Every booking / quote request is routed to this provider.
  ownerEmail: 'terrazaslawncare@gmail.com',
} as const

// Towns served (zips are editable — add any zip the crew will drive to)
export const SERVICE_AREAS = [
  { town: 'Liberal', state: 'KS', zips: ['67901', '67905'] },
  { town: 'Garden City', state: 'KS', zips: ['67846'] },
  { town: 'Dodge City', state: 'KS', zips: ['67801'] },
  { town: 'Hugoton', state: 'KS', zips: ['67951'] },
  { town: 'Sublette', state: 'KS', zips: ['67877'] },
  { town: 'Satanta', state: 'KS', zips: ['67870'] },
  { town: 'Guymon', state: 'OK', zips: ['73942'] },
  { town: 'Beaver County', state: 'OK', zips: ['73932', '73938', '73950'] },
  { town: 'Perryton', state: 'TX', zips: ['79070'] },
] as const

export const ALL_SERVICE_ZIPS: string[] = SERVICE_AREAS.flatMap((a) => [...a.zips])

export function isZipServed(zip: string): boolean {
  return ALL_SERVICE_ZIPS.includes(zip.trim())
}

// ── Services offered ────────────────────────────────────────────────
// mode: 'book'  → instant tier pricing (see lib/constants.ts TIERS), pay after service
// mode: 'quote' → customer describes the work, business replies with a price
export type ServiceMode = 'book' | 'quote'

export interface ServiceDef {
  id: string
  name: string
  emoji: string
  blurb: string
  mode: ServiceMode
  seasonal?: boolean
}

export const SERVICES: ServiceDef[] = [
  { id: 'mowing', name: 'Lawn Mowing & Maintenance', emoji: '🌱', blurb: 'Mowing, edging, string trimming and cleanup — one-time or recurring.', mode: 'book' },
  { id: 'tree_removal', name: 'Tree Removal', emoji: '🌳', blurb: 'Safe removal of trees of any size, including haul-away.', mode: 'quote' },
  { id: 'tree_trimming', name: 'Tree Trimming & Pruning', emoji: '🍃', blurb: 'Health, storm-damage and clearance pruning by an experienced crew.', mode: 'quote' },
  { id: 'stump_grinding', name: 'Stump Grinding', emoji: '🪵', blurb: 'Stumps ground below grade so you can replant or lay sod.', mode: 'quote' },
  { id: 'landscaping', name: 'Landscaping', emoji: '🏡', blurb: 'Beds, rock, mulch, plantings and full yard makeovers.', mode: 'quote' },
  { id: 'sod', name: 'Sod Installation', emoji: '🟩', blurb: 'Ground prep and fresh sod for an instant lawn.', mode: 'quote' },
  { id: 'irrigation', name: 'Irrigation & Sprinklers', emoji: '💧', blurb: 'Sprinkler installation, repair, and seasonal startup / blowout.', mode: 'quote' },
  { id: 'weed_control', name: 'Weed Control', emoji: '🌾', blurb: 'Treatment programs that keep weeds from coming back.', mode: 'quote' },
  { id: 'snow_removal', name: 'Snow Removal', emoji: '❄️', blurb: 'Driveways, sidewalks and lots cleared fast.', mode: 'quote', seasonal: true },
]

export function getService(id: string | null | undefined): ServiceDef | undefined {
  return SERVICES.find((s) => s.id === id)
}
