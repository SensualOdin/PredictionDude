import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validateRequest, VALIDATION_LIMITS } from '@/lib/validation';

// Save prediction schema
const savePredictionSchema = z.object({
    prediction: z.object({
        winner: z.string().min(1).max(500),
        confidence: z.number().min(0).max(100),
        reasoning: z.string().max(5000),
    }),
    options: z.array(z.object({
        name: z.string().min(1).max(500),
        impliedProbability: z.number().min(0).max(100),
        aiProbability: z.number().min(0).max(100),
        edge: z.number().min(-100).max(100),
        recommendedStake: z.number().min(0).max(100),
    })).min(1).max(20),
    isParlay: z.boolean().default(false),
    question: z.string().min(1).max(VALIDATION_LIMITS.MAX_QUESTION_LENGTH),
    bankroll: z.number().min(VALIDATION_LIMITS.MIN_BANKROLL).max(VALIDATION_LIMITS.MAX_BANKROLL),
    inputMode: z.enum(['images', 'manual']),
    parlay: z.object({
        combinedOdds: z.number().min(1),
        combinedProbability: z.number().min(0).max(100),
        potentialPayout: z.number().min(0),
        recommendedStake: z.number().min(0),
    }).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validation = validateRequest(savePredictionSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { prediction, options, isParlay, question, bankroll, inputMode } = validation.data;

        // Insert prediction
        const { data: predictionData, error: predictionError } = await supabase
            .from('predictions')
            .insert({
                user_id: user.id,
                question,
                bankroll,
                is_parlay: isParlay || false,
                input_mode: inputMode || 'images',
                predicted_winner: prediction?.winner,
                confidence: prediction?.confidence,
                reasoning: prediction?.reasoning,
                parlay_combined_odds: body.parlay?.combinedOdds,
                parlay_combined_probability: body.parlay?.combinedProbability,
                parlay_potential_payout: body.parlay?.potentialPayout,
                parlay_recommended_stake: body.parlay?.recommendedStake,
            })
            .select()
            .single();

        if (predictionError) {
            console.error('Error saving prediction:', predictionError);
            return NextResponse.json(
                { error: 'Failed to save prediction. Please try again.' },
                { status: 500 }
            );
        }

        // Insert prediction options
        if (options && options.length > 0) {
            const optionsToInsert = options.map((opt) => ({
                prediction_id: predictionData.id,
                name: opt.name,
                implied_probability: opt.impliedProbability,
                ai_probability: opt.aiProbability,
                edge: opt.edge,
                recommended_stake: opt.recommendedStake,
            }));

            const { error: optionsError } = await supabase
                .from('prediction_options')
                .insert(optionsToInsert);

            if (optionsError) {
                console.error('Error saving options:', optionsError);
                // Don't fail the request if options fail, prediction is already saved
            }
        }

        return NextResponse.json({
            success: true,
            predictionId: predictionData.id,
        });

    } catch (error) {
        console.error('Save bet error:', error);
        return NextResponse.json(
            { error: 'Failed to save bet. Please try again.' },
            { status: 500 }
        );
    }
}
