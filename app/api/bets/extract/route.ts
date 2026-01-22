import { NextRequest, NextResponse } from 'next/server';
import { extractBetSchema, validateRequest } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

const EXTRACT_PROMPT = `You are an OCR and data extraction system. Extract betting information from the uploaded screenshot(s).

## Your Task
Analyze the image(s) and extract:
1. All betting options/legs visible
2. Odds for each option (convert to decimal format)
3. Stake amount (if visible)
4. Whether this is a parlay/multi-leg bet
5. Any notes (platform name, bet type, etc.)

## Output Format
Respond with ONLY valid JSON:

{
  "isParlay": boolean,
  "options": [
    {
      "name": "string - Name of bet (e.g., 'Lakers ML', 'Cade Cunningham Over 20.5 points')",
      "odds": number - Decimal odds (e.g., 1.5, 2.0, 3.5)
    }
  ],
  "stake": number | null - Stake amount if visible, otherwise null,
  "notes": "string - Platform name, bet type, or other relevant info"
}

## Odds Conversion Rules
- American odds +150 → 2.5 decimal
- American odds -200 → 1.5 decimal
- Fractional 3/1 → 4.0 decimal
- If odds show as percentage (e.g., 45%), convert to decimal: 1 / (percentage/100)

## Detection Rules
- Single option → isParlay: false
- Multiple options → isParlay: true
- Look for keywords: "parlay", "multi", "combo", "accumulator"

## Platform Detection
Identify the platform if visible: Kalshi, DraftKings, FanDuel, Caesars, BetMGM, etc.

Output ONLY the JSON object. No markdown, no explanations.`;

export async function POST(request: NextRequest) {
    try {
        // Get user for rate limiting
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const identifier = user?.id || request.headers.get('x-forwarded-for') || 'anonymous';

        // Check rate limit
        const rateLimit = checkRateLimit(identifier, RATE_LIMITS.EXTRACT);
        if (!rateLimit.success) {
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded. Please try again later.',
                    retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': rateLimit.limit.toString(),
                        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                        'X-RateLimit-Reset': rateLimit.reset.toString(),
                    },
                }
            );
        }

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API configuration error' },
                { status: 500 }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validation = validateRequest(extractBetSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { images } = validation.data;

        // Build content parts for Gemini API
        const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

        // Add all images
        for (const imageBase64 of images) {
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            });
        }

        // Add the extraction prompt
        parts.push({ text: EXTRACT_PROMPT });

        // Call Gemini Flash for fast OCR
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        const geminiPayload = {
            contents: [{ parts }],
            generationConfig: {
                temperature: 0.1, // Low temperature for accurate extraction
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            }
        };

        console.log(`Calling Gemini Flash for OCR extraction (${images.length} images)`);
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(geminiPayload),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API Error:', geminiResponse.status, errorText);
            return NextResponse.json(
                { error: 'Failed to extract bet information. Please try again.' },
                { status: 500 }
            );
        }

        const geminiData = await geminiResponse.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.error('No text in Gemini response');
            return NextResponse.json(
                { error: 'Invalid AI response. Please try again.' },
                { status: 500 }
            );
        }

        // Parse JSON response
        let extractedData;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[0]);
            } else {
                extractedData = JSON.parse(text);
            }
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw response:', text.substring(0, 1000));
            return NextResponse.json(
                { error: 'Failed to parse extraction result. Please try again.' },
                { status: 500 }
            );
        }

        console.log('Successfully extracted bet data');
        return NextResponse.json(extractedData);

    } catch (error) {
        console.error('Extraction API Error:', error);
        return NextResponse.json(
            { error: 'Failed to extract bet information. Please try again.' },
            { status: 500 }
        );
    }
}
