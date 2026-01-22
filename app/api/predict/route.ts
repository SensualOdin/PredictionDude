import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT, PARLAY_PROMPT_ADDITION } from '@/lib/systemPrompt';
import { PredictionResponse } from '@/lib/types';
import { predictionRequestSchema, validateRequest } from '@/lib/validation';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getSystemPrompt } from '@/lib/promptLoader';

export async function POST(request: NextRequest) {
  try {
    // Get user for rate limiting
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const identifier = user?.id || request.headers.get('x-forwarded-for') || 'anonymous';

    // Check rate limit
    const rateLimit = checkRateLimit(identifier, RATE_LIMITS.PREDICT);
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
            'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Check if API key is configured
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateRequest(predictionRequestSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { question, bankroll, isParlay, inputMode, images, manualInput } = validation.data;

    // Load user's custom prompt or use default
    const userPrompt = user?.id ? await getSystemPrompt(user.id) : SYSTEM_PROMPT;

    // Prepare the prompt
    const basePrompt = isParlay ? `${userPrompt}\n\n${PARLAY_PROMPT_ADDITION}` : userPrompt;

    let taskDescription = '';
    if (inputMode === 'images') {
      taskDescription = `Analyze the uploaded image${images!.length > 1 ? 's' : ''} containing betting odds or prediction market options. Extract all options and their odds, calculate probabilities, identify edges, and recommend a bankroll distribution strategy.`;
    } else {
      taskDescription = `Analyze the following betting options provided by the user. Parse each option, extract odds, calculate probabilities, identify edges, and recommend a bankroll distribution strategy.

USER PROVIDED OPTIONS:
${manualInput}`;
    }

    if (isParlay) {
      taskDescription += '\n\nIMPORTANT: The user wants to place a PARLAY bet. Calculate combined odds and recommend a single stake for the parlay.';
    }

    const prompt = `${basePrompt}

---

USER QUERY: ${question}

USER BANKROLL: $${bankroll}

BET TYPE: ${isParlay ? 'PARLAY (combined bet)' : 'INDIVIDUAL BETS'}

TASK: ${taskDescription}

Remember: Output ONLY valid JSON matching the schema provided in the system prompt.`;

    // Build content parts for Gemini API
    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

    // Add images if in image mode
    if (inputMode === 'images' && images) {
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
    }

    // Add the text prompt
    parts.push({ text: prompt });

    // Direct API call to Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

    const geminiPayload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      }
    };

    console.log(`Calling Gemini API... (${inputMode} mode, parlay: ${isParlay}, ${images?.length || 0} images)`);
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
        { error: 'AI service error. Please try again.' },
        { status: 500 }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract text from Gemini response
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response');
      return NextResponse.json(
        { error: 'Invalid AI response. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Response text length:', text.length);

    // Parse JSON response
    let predictionData: PredictionResponse;
    try {
      // Try to extract JSON if there's extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        predictionData = JSON.parse(jsonMatch[0]);
      } else {
        predictionData = JSON.parse(text);
      }
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', text.substring(0, 1000));
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

    // Calculate actual dollar amounts for each option
    // Validate that recommendedStake is within bounds (0-100)
    const optionsWithAmounts = predictionData.options.map(option => {
      const stake = Math.max(0, Math.min(100, option.recommendedStake || 0));
      return {
        ...option,
        recommendedStake: stake,
        recommendedAmount: (stake / 100) * bankroll,
      };
    });

    return NextResponse.json({
      ...predictionData,
      options: optionsWithAmounts,
      bankroll,
      isParlay,
    });

  } catch (error) {
    console.error('Prediction API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction. Please try again.' },
      { status: 500 }
    );
  }
}
