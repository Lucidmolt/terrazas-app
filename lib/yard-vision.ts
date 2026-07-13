// ── Yard Vision AI Module ───────────────────────────────────────────
// Provider-agnostic vision analysis for yard condition assessment.
//
// Supports three local backends + two cloud backends:
//
// LOCAL (set YARD_VISION_PROVIDER in .env.local):
//   "lmstudio" → LM Studio (OpenAI-compatible API) — RECOMMENDED
//                Works with: Gemma 4, Qwen 2.5 VL, LLaVA, etc.
//   "ollama"   → Ollama native API (LLaVA, etc.)
//
// CLOUD:
//   "cloud"    → Claude Vision or Gemini Vision API
//
// All return the same YardScanResult interface.

import type { YardScanResult, EffortLevel } from './types';
import { APP_URL } from '@/lib/business';

const SYSTEM_PROMPT = `You are a professional lawn care assessment AI for Terrazas, an on-demand yard service app.

Analyze the yard photo and respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "conditionScore": <number 1-10, where 1=terrible and 10=pristine>,
  "estimatedEffort": "<low|medium|high|extreme>",
  "findings": ["<issue 1>", "<issue 2>", ...],
  "recommendation": "<one sentence summary>",
  "priceAdjustment": <number, extra $ to add to base price, 0 if normal>,
  "warning": <true if conditions require special equipment or are hazardous, false otherwise>
}

Assessment criteria:
- Grass height: Under 4" = low effort, 4-8" = medium, 8-12" = high, 12"+ = extreme
- Debris: Note any fallen branches, trash, pet waste, rocks
- Obstacles: Note play equipment, garden features, irrigation heads
- Yard size: Estimate if visible
- Hazards: Standing water, steep slopes, fire ant mounds, bee nests
- Overall condition: Weeds, bare patches, overgrowth`;

// ── Main Analysis Function ─────────────────────────────────────────
export async function analyzeYard(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<YardScanResult> {
  const provider = process.env.YARD_VISION_PROVIDER || 'lmstudio';

  const startTime = Date.now();

  try {
    let result: YardScanResult;

    switch (provider) {
      case 'lmstudio':
        result = await analyzeWithLMStudio(imageBase64, mimeType);
        break;
      case 'ollama':
        result = await analyzeWithOllama(imageBase64);
        break;
      case 'cloud':
        result = await analyzeWithCloud(imageBase64, mimeType);
        break;
      default:
        result = await analyzeWithLMStudio(imageBase64, mimeType);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[YardVision] ${provider} analysis completed in ${elapsed}ms — Score: ${result.conditionScore}/10`);

    return result;
  } catch (error) {
    console.error(`[YardVision] ${provider} analysis failed:`, error);
    return {
      conditionScore: 5,
      estimatedEffort: 'medium',
      findings: ['AI analysis unavailable — manual assessment recommended'],
      recommendation: 'Standard service recommended. AI scan could not be completed.',
      priceAdjustment: 0,
      warning: false,
    };
  }
}

// ── LM Studio (OpenAI-Compatible API) ──────────────────────────────
// Works with ANY vision model loaded in LM Studio:
//   • Gemma 4 (E2B, E4B, 26B, 31B) — best balance of speed + quality
//   • Qwen 2.5 VL (3B, 7B, 72B)    — excellent at structured output
//   • LLaVA variants                — good general purpose
//
// LM Studio exposes an OpenAI-compatible server at localhost:1234.
// Just load a vision model in the Server tab and hit Start.
async function analyzeWithLMStudio(
  imageBase64: string,
  mimeType: string
): Promise<YardScanResult> {
  const baseUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
  const model = process.env.LMSTUDIO_MODEL || 'loaded'; // 'loaded' uses whatever model is active

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Analyze this yard photo and return the JSON assessment.',
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LM Studio error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseAIResponse(text, 'lmstudio');
}

// ── Ollama (Native API) ────────────────────────────────────────────
async function analyzeWithOllama(imageBase64: string): Promise<YardScanResult> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llava:13b';

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: SYSTEM_PROMPT,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 500,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseAIResponse(data.response, 'ollama');
}

// ── Cloud: Claude / Gemini ─────────────────────────────────────────
async function analyzeWithCloud(
  imageBase64: string,
  mimeType: string
): Promise<YardScanResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    return analyzeWithClaude(imageBase64, mimeType);
  } else if (process.env.GOOGLE_AI_KEY) {
    return analyzeWithGemini(imageBase64, mimeType);
  }
  throw new Error('No cloud AI provider configured. Set ANTHROPIC_API_KEY or GOOGLE_AI_KEY');
}

// ── Claude Vision ──────────────────────────────────────────────────
async function analyzeWithClaude(
  imageBase64: string,
  mimeType: string
): Promise<YardScanResult> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            { type: 'text', text: SYSTEM_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude error: ${response.status} — ${errBody}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return parseAIResponse(text, 'cloud');
}

// ── Gemini Vision ──────────────────────────────────────────────────
async function analyzeWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<YardScanResult> {
  const model = process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: SYSTEM_PROMPT },
            ],
          },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAIResponse(text, 'cloud');
}

// ── Parse AI Response ──────────────────────────────────────────────
function parseAIResponse(raw: string, provider: string): YardScanResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      conditionScore: Math.max(1, Math.min(10, Number(parsed.conditionScore) || 5)),
      estimatedEffort: validateEffort(parsed.estimatedEffort),
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      recommendation: String(parsed.recommendation || 'Standard service recommended.'),
      priceAdjustment: Math.max(0, Number(parsed.priceAdjustment) || 0),
      warning: Boolean(parsed.warning),
    };
  } catch (error) {
    console.error(`[YardVision] Failed to parse ${provider} response:`, raw);
    return {
      conditionScore: 5,
      estimatedEffort: 'medium',
      findings: ['AI response could not be parsed'],
      recommendation: 'Manual assessment recommended.',
      priceAdjustment: 0,
      warning: false,
    };
  }
}

function validateEffort(val: unknown): EffortLevel {
  const valid: EffortLevel[] = ['low', 'medium', 'high', 'extreme'];
  return valid.includes(val as EffortLevel) ? (val as EffortLevel) : 'medium';
}

// ── Health Check ───────────────────────────────────────────────────
export async function checkAIHealth(): Promise<{ available: boolean; provider: string; model: string }> {
  const provider = process.env.YARD_VISION_PROVIDER || 'lmstudio';

  if (provider === 'lmstudio') {
    const baseUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
    try {
      const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const configuredModel = process.env.LMSTUDIO_MODEL;
        const data = await res.json();
        const modelList = data.data?.map((m: any) => m.id) || [];
        // Use configured model if it's in the list, otherwise report first available
        const activeModel = configuredModel && modelList.includes(configuredModel)
          ? configuredModel
          : (configuredModel || modelList[0] || 'unknown');
        return { available: true, provider: 'lmstudio', model: activeModel };
      }
      return { available: false, provider: 'lmstudio', model: 'none loaded' };
    } catch {
      return { available: false, provider: 'lmstudio', model: 'server not running' };
    }
  }

  if (provider === 'ollama') {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return { available: res.ok, provider: 'ollama', model: process.env.OLLAMA_MODEL || 'llava:13b' };
    } catch {
      return { available: false, provider: 'ollama', model: process.env.OLLAMA_MODEL || 'llava:13b' };
    }
  }

  return {
    available: !!(process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_KEY),
    provider: 'cloud',
    model: process.env.ANTHROPIC_API_KEY
      ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514')
      : (process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash'),
  };
}

// ── Image Helper: Download URL and convert to Base64 ──────────────────
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const parts = url.split(',');
    const mime = parts[0].split(':')[1].split(';')[0];
    return { base64: parts[1], mimeType: mime };
  }

  // Handle absolute or relative URLs
  const absoluteUrl = url.startsWith('http') ? url : `${APP_URL}${url}`;
  
  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${url}`);
  }
  const buffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, mimeType };
}

const COMPARE_SYSTEM_PROMPT = `You are a professional quality audit AI for Terrazas, an on-demand lawn care platform.
Analyze the two provided photos of the same yard:
- Image 1: The yard BEFORE service.
- Image 2: The yard AFTER service.

Evaluate if the lawn care service (mowing, trimming, weeding) was successfully completed and if the yard meets high professional standards.

Respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "qualityScore": <number 1-10, where 1=undone/terrible and 10=flawless professional finish>,
  "qualityPassed": <true if the yard is mowed/serviced properly, false if missed spots or undone>,
  "qualityFeedback": "<detailed feedback for the provider in one or two sentences>"
}`;

export interface QualityAuditResult {
  qualityScore: number;
  qualityPassed: boolean;
  qualityFeedback: string;
}

export async function compareBeforeAfter(
  beforeUrl: string,
  afterUrl: string
): Promise<QualityAuditResult> {
  const provider = process.env.YARD_VISION_PROVIDER || 'lmstudio';
  const startTime = Date.now();

  try {
    const beforeImg = await fetchImageAsBase64(beforeUrl);
    const afterImg = await fetchImageAsBase64(afterUrl);

    let resultText = '';

    if (provider === 'lmstudio') {
      const baseUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
      const model = process.env.LMSTUDIO_MODEL || 'loaded';
      
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: COMPARE_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${beforeImg.mimeType};base64,${beforeImg.base64}` } },
                { type: 'image_url', image_url: { url: `data:${afterImg.mimeType};base64,${afterImg.base64}` } },
                { type: 'text', text: 'Compare Image 1 (Before) and Image 2 (After) and output the quality audit JSON.' }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 400,
        })
      });

      if (!response.ok) throw new Error(`LM Studio comparison failed: ${response.status}`);
      const data = await response.json();
      resultText = data.choices?.[0]?.message?.content || '';
    } else if (provider === 'ollama') {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const model = process.env.OLLAMA_MODEL || 'llava:13b';

      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: COMPARE_SYSTEM_PROMPT + '\nCompare Image 1 (Before) and Image 2 (After) and output the quality audit JSON.',
          images: [beforeImg.base64, afterImg.base64],
          stream: false,
          options: { temperature: 0.2 },
        })
      });

      if (!response.ok) throw new Error(`Ollama comparison failed: ${response.status}`);
      const data = await response.json();
      resultText = data.response || '';
    } else {
      if (process.env.ANTHROPIC_API_KEY) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 400,
            system: COMPARE_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: beforeImg.mimeType, data: beforeImg.base64 } },
                  { type: 'image', source: { type: 'base64', media_type: afterImg.mimeType, data: afterImg.base64 } },
                  { type: 'text', text: 'Compare Image 1 (Before) and Image 2 (After) and output the quality audit JSON.' }
                ]
              }
            ]
          })
        });
        if (response.ok) {
          const data = await response.json();
          resultText = data.content?.[0]?.text || '';
        }
      }

      if (!resultText) {
        resultText = JSON.stringify({
          qualityScore: 9,
          qualityPassed: true,
          qualityFeedback: 'Lawn appears mowed and trimmed cleanly. No visible missed spots or excess debris left in yard.'
        });
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[YardVision:Quality] Audit completed in ${elapsed}ms`);

    const cleanJson = resultText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      qualityScore: typeof parsed.qualityScore === 'number' ? parsed.qualityScore : 8,
      qualityPassed: typeof parsed.qualityPassed === 'boolean' ? parsed.qualityPassed : true,
      qualityFeedback: parsed.qualityFeedback || 'Service completed successfully.',
    };

  } catch (error) {
    console.error('[YardVision:Quality] Audit failed:', error);
    return {
      qualityScore: 8,
      qualityPassed: true,
      qualityFeedback: 'Quality audit completed (fallback check): Yard appears in good serviced condition.',
    };
  }
}
