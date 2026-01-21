import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT, PARLAY_PROMPT_ADDITION } from '@/lib/systemPrompt';
import { PredictionRequest, PredictionResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google AI API key not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    const body: PredictionRequest = await request.json();
    const { question, bankroll, isParlay, inputMode, images, manualInput } = body;

    // Validation
    if (!question || !bankroll) {
      return NextResponse.json(
        { error: 'Missing required fields: question or bankroll' },
        { status: 400 }
      );
    }

    if (inputMode === 'images' && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: 'Please upload at least one image' },
        { status: 400 }
      );
    }

    if (inputMode === 'manual' && !manualInput?.trim()) {
      return NextResponse.json(
        { error: 'Please provide betting options text' },
        { status: 400 }
      );
    }

    // Prepare the prompt
    const basePrompt = isParlay ? `${SYSTEM_PROMPT}\n\n${PARLAY_PROMPT_ADDITION}` : SYSTEM_PROMPT;

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
    const parts: any[] = [];

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
        {
          error: 'Gemini API call failed',
          status: geminiResponse.status,
          details: errorText.substring(0, 500),
          hint: 'Check if your API key is valid at https://aistudio.google.com/app/apikey'
        },
        { status: 500 }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    // Extract text from Gemini response
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('No text in Gemini response:', JSON.stringify(geminiData, null, 2));
      return NextResponse.json(
        {
          error: 'No response text from Gemini',
          geminiResponse: geminiData
        },
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
        {
          error: 'Failed to parse AI response as JSON',
          rawResponse: text.substring(0, 1000)
        },
        { status: 500 }
      );
    }

    // Calculate actual dollar amounts for each option
    const optionsWithAmounts = predictionData.options.map(option => ({
      ...option,
      recommendedAmount: (option.recommendedStake / 100) * bankroll,
    }));

    return NextResponse.json({
      ...predictionData,
      options: optionsWithAmounts,
      bankroll,
      isParlay,
    });

  } catch (error) {
    console.error('Prediction API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate prediction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
