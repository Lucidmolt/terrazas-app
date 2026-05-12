import { NextResponse } from 'next/server';
import { calculateDynamicPrice, previewPrice } from '@/lib/pricing';

// GET /api/pricing/preview — real-time price preview (no DB calls)
// Used by the UI to update price as customer changes options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const tier = (searchParams.get('tier') || 'basic') as 'basic' | 'premium';
  const scope = (searchParams.get('scope') || 'front_back') as any;
  const conditionScore = searchParams.get('conditionScore')
    ? parseFloat(searchParams.get('conditionScore')!)
    : undefined;
  const lotSize = (searchParams.get('lotSize') || 'medium') as any;
  const urgency = (searchParams.get('urgency') || 'same_day') as any;
  const extras = searchParams.get('extras')
    ? searchParams.get('extras')!.split(',')
    : [];
  const tipAmount = searchParams.get('tip')
    ? parseFloat(searchParams.get('tip')!)
    : 0;

  const preview = previewPrice({
    tier,
    scope,
    conditionScore,
    lotSize,
    urgency,
    extras,
    tipAmount,
  });

  return NextResponse.json(preview);
}

// POST /api/pricing — full price calculation with demand surge
// Called when customer is ready to confirm the job
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const pricing = await calculateDynamicPrice({
      tier: body.tier || 'basic',
      scope: body.scope || 'front_back',
      conditionScore: body.conditionScore,
      lotSize: body.lotSize || 'medium',
      urgency: body.urgency || 'same_day',
      extras: body.extras || [],
      zipCode: body.zipCode,
      tipAmount: body.tipAmount || 0,
    });

    return NextResponse.json(pricing);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
