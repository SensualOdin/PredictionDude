import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { PredictionRequest, PredictionResponse } from '@/lib/types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Google AI API key not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    const body: PredictionRequest = await request.json();
    const { question, imageBase64, bankroll } = body;

    if (!question || !imageBase64 || !bankroll) {
      return NextResponse.json(
        { error: 'Missing required fields: question, imageBase64, or bankroll' },
        { status: 400 }
      );
    }

    // Use Gemini 1.5 Pro (most capable stable model) for multimodal analysis
    // Available models: gemini-1.5-pro, gemini-1.5-flash, gemini-1.5-pro-latest
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    });

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Prepare the prompt with system instructions and user query
    const prompt = `${SYSTEM_PROMPT}

---

USER QUERY: ${question}

USER BANKROLL: $${bankroll}

TASK: Analyze the uploaded image containing betting odds or prediction market options. Extract all options and their odds, calculate probabilities, identify edges, and recommend a bankroll distribution strategy.

Remember: Output ONLY valid JSON matching the schema provided in the system prompt.`;

    // Generate content with image
    let result;
    try {
      result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        },
        prompt,
      ]);
    } catch (apiError: any) {
      console.error('Gemini API Error:', apiError);
      console.error('Error details:', JSON.stringify(apiError, null, 2));
      return NextResponse.json(
        {
          error: 'Gemini API call failed',
          details: apiError.message || 'Unknown API error',
          errorInfo: apiError.toString(),
          hint: 'Check if your API key is valid at https://aistudio.google.com/app/apikey'
        },
        { status: 500 }
      );
    }

    const response = result.response;
    const text = response.text();

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
      console.error('Raw response:', text);
      return NextResponse.json(
        {
          error: 'Failed to parse AI response as JSON',
          rawResponse: text
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
    });

  } catch (error) {
    console.error('Prediction API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate prediction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
