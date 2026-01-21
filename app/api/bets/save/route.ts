import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

        const body = await request.json();
        const { prediction, options, isParlay, question, bankroll, inputMode } = body;

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
                { error: 'Failed to save prediction', details: predictionError.message },
                { status: 500 }
            );
        }

        // Insert prediction options
        if (options && options.length > 0) {
            const optionsToInsert = options.map((opt: any) => ({
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
            }
        }

        return NextResponse.json({
            success: true,
            predictionId: predictionData.id,
        });

    } catch (error) {
        console.error('Save bet error:', error);
        return NextResponse.json(
            { error: 'Failed to save bet', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
