import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';

const LEARNING_PROMPT = `You are an AI system designed to analyze prediction results and improve a forecasting system prompt.

## Your Task
Analyze the prediction results provided and generate improvements to the system prompt based on what worked and what didn't.

## Analysis Steps
1. Calculate calibration: Compare AI probabilities to actual outcomes
2. Identify patterns in correct predictions (what factors led to success?)
3. Identify patterns in incorrect predictions (what was missed?)
4. Determine if certain types of bets perform better/worse
5. Look for systematic biases (overconfidence, underconfidence, etc.)

## Output Format
Respond with ONLY valid JSON:
{
  "analysis": {
    "calibration": "string - How well calibrated are the predictions?",
    "strengths": ["array of things the model does well"],
    "weaknesses": ["array of areas for improvement"],
    "patterns": ["array of patterns noticed in correct/incorrect predictions"]
  },
  "recommendations": [
    {
      "section": "string - Which section of the prompt to update",
      "change": "string - What specific change to make",
      "rationale": "string - Why this change should improve predictions"
    }
  ],
  "updatedPromptSections": {
    "COGNITIVE_POSTURE": "string - Updated cognitive posture guidance if needed, or null",
    "DOMAIN_ADJUSTMENTS": "string - Updated domain-specific adjustments if needed, or null",
    "STAKE_DISTRIBUTION": "string - Updated stake distribution rules if needed, or null",
    "DEBIASING_CHECKLIST": "string - Updated debiasing checklist if needed, or null"
  },
  "summary": "string - A brief summary of the key learnings and improvements"
}`;

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all settled predictions with their options
        const { data: predictions, error: fetchError } = await supabase
            .from('predictions')
            .select(`
        *,
        prediction_options (*)
      `)
            .eq('user_id', user.id)
            .neq('outcome', 'pending')
            .order('created_at', { ascending: false })
            .limit(50);

        if (fetchError) {
            return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
        }

        if (!predictions || predictions.length < 3) {
            return NextResponse.json({
                error: 'Need at least 3 settled predictions to run learning analysis',
                count: predictions?.length || 0
            }, { status: 400 });
        }

        // Build analysis prompt
        const resultsData = predictions.map(p => ({
            predicted_winner: p.predicted_winner,
            confidence: p.confidence,
            outcome: p.outcome,
            is_parlay: p.is_parlay,
            options: p.prediction_options.map((o: any) => ({
                name: o.name,
                ai_probability: o.ai_probability,
                implied_probability: o.implied_probability,
                edge: o.edge,
                stake: o.recommended_stake,
                outcome: o.outcome
            }))
        }));

        const winCount = predictions.filter(p => p.outcome === 'won').length;
        const totalCount = predictions.length;

        const analysisPrompt = `${LEARNING_PROMPT}

## Current System Prompt
${SYSTEM_PROMPT}

## Prediction Results (${totalCount} bets, ${winCount} wins, ${((winCount / totalCount) * 100).toFixed(1)}% win rate)
${JSON.stringify(resultsData, null, 2)}

Analyze these results and provide recommendations to improve the forecasting system.
Output ONLY valid JSON.`;

        // Call Gemini for analysis
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: analysisPrompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 8192,
                }
            }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Gemini API failed' }, { status: 500 });
        }

        const geminiData = await response.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return NextResponse.json({ error: 'No response from Gemini' }, { status: 500 });
        }

        // Parse the JSON response
        let learningData;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            learningData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
        } catch (e) {
            return NextResponse.json({ error: 'Failed to parse learning response' }, { status: 500 });
        }

        // Save the learning iteration
        const { data: savedIteration, error: saveError } = await supabase
            .from('learning_iterations')
            .insert({
                user_id: user.id,
                original_prompt: SYSTEM_PROMPT,
                updated_prompt: JSON.stringify(learningData.updatedPromptSections),
                analysis: JSON.stringify(learningData.analysis),
                predictions_analyzed: totalCount,
                win_rate: (winCount / totalCount) * 100,
            })
            .select()
            .single();

        if (saveError) {
            console.error('Error saving learning iteration:', saveError);
        }

        return NextResponse.json({
            success: true,
            stats: {
                total: totalCount,
                won: winCount,
                winRate: ((winCount / totalCount) * 100).toFixed(1),
            },
            analysis: learningData.analysis,
            recommendations: learningData.recommendations,
            updatedPromptSections: learningData.updatedPromptSections,
            summary: learningData.summary,
            iterationId: savedIteration?.id,
        });

    } catch (error) {
        console.error('Learning API error:', error);
        return NextResponse.json({ error: 'Learning analysis failed' }, { status: 500 });
    }
}
