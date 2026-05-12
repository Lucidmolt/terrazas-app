import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeYard, checkAIHealth } from '@/lib/yard-vision';

// POST /api/yard-vision — analyze a yard photo
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, mimeType, jobId } = body;

    if (!image) {
      return NextResponse.json({ error: 'Base64 image data is required' }, { status: 400 });
    }

    // Run AI analysis
    const result = await analyzeYard(image, mimeType || 'image/jpeg');

    // Save scan to database
    const scan = await db.yardScan.create({
      data: {
        jobId: jobId || null,
        imageUrl: `data:${mimeType || 'image/jpeg'};base64,${image.substring(0, 50)}...`, // Store reference, not full image
        provider: process.env.YARD_VISION_PROVIDER || 'local',
        modelUsed: process.env.YARD_VISION_PROVIDER === 'local'
          ? (process.env.OLLAMA_MODEL || 'llava:13b')
          : (process.env.ANTHROPIC_API_KEY ? 'claude' : 'gemini'),
        conditionScore: result.conditionScore,
        estimatedEffort: result.estimatedEffort,
        findings: JSON.stringify(result.findings),
        rawResponse: JSON.stringify(result),
      },
    });

    // If linked to a job, update the job with AI findings
    if (jobId) {
      await db.job.update({
        where: { id: jobId },
        data: {
          conditionNotes: result.recommendation,
          aiWarning: result.warning,
          aiProvider: process.env.YARD_VISION_PROVIDER || 'local',
          price: { increment: result.priceAdjustment },
        },
      });
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
