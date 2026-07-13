import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeYard, checkAIHealth } from '@/lib/yard-vision';
import { requireAuth } from '@/lib/api-auth';

// POST /api/yard-vision — analyze a yard photo
export async function POST(request: Request) {
  // SECURITY: Require authentication — this writes YardScan rows and can mutate job prices
  const { dbUser, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { image, mimeType, jobId } = body;

    if (!image) {
      return NextResponse.json({ error: 'Base64 image data is required' }, { status: 400 });
    }

    // Run AI analysis
    const result = await analyzeYard(image, mimeType || 'image/jpeg');

    // Valid YARD_VISION_PROVIDER values: 'lmstudio' | 'ollama' | 'cloud' ('lmstudio' and 'ollama' are local)
    const visionProvider = process.env.YARD_VISION_PROVIDER || 'lmstudio';
    const isLocalProvider = visionProvider === 'lmstudio' || visionProvider === 'ollama';

    // Save scan to database
    const scan = await db.yardScan.create({
      data: {
        jobId: jobId || null,
        imageUrl: `data:${mimeType || 'image/jpeg'};base64,${image.substring(0, 50)}...`, // Store reference, not full image
        provider: visionProvider,
        modelUsed: isLocalProvider
          ? (visionProvider === 'ollama'
              ? (process.env.OLLAMA_MODEL || 'llava:13b')
              : (process.env.LMSTUDIO_MODEL || 'lmstudio'))
          : (process.env.ANTHROPIC_API_KEY ? 'claude' : 'gemini'),
        conditionScore: result.conditionScore,
        estimatedEffort: result.estimatedEffort,
        findings: JSON.stringify(result.findings),
        rawResponse: JSON.stringify(result),
      },
    });

    // If linked to a job, update the job with AI findings — but only if the job
    // belongs to the authenticated user (never let callers mutate others' job prices)
    if (jobId) {
      const job = await db.job.findUnique({ where: { id: jobId } });
      if (job && dbUser && job.customerId === dbUser.id) {
        await db.job.update({
          where: { id: jobId },
          data: {
            conditionNotes: result.recommendation,
            aiWarning: result.warning,
            aiProvider: visionProvider,
            price: { increment: result.priceAdjustment },
          },
        });
      }
    }

    return NextResponse.json({
      scan: {
        id: scan.id,
        ...result,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/yard-vision — check AI service health
export async function GET() {
  try {
    const health = await checkAIHealth();
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      { available: false, provider: 'unknown', model: 'unknown', error: error.message },
      { status: 500 }
    );
  }
}
