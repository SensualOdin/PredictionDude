import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { customBetSchema, validateRequest } from '@/lib/validation';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse and validate request body
        const body = await request.json();
        const validation = validateRequest(customBetSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { betName, odds, stake, isParlay, notes, legs, screenshots } = validation.data;

        // Calculate combined odds for parlay
        const combinedOdds = isParlay && legs
            ? legs.reduce((acc: number, leg) => acc * leg.odds, 1)
            : odds;

        // Calculate implied probability from odds
        const impliedProb = combinedOdds >= 1 ? (1 / combinedOdds) * 100 : 0;

        // Insert custom prediction
        const { data: predictionData, error: predictionError } = await supabase
            .from('predictions')
            .insert({
                user_id: user.id,
                question: notes || 'Custom bet',
                bankroll: stake,
                is_parlay: isParlay || false,
                input_mode: 'manual',
                predicted_winner: betName,
                confidence: null,
                reasoning: isParlay && legs
                    ? `Custom parlay: ${legs.map((l) => l.name).join(' + ')} at ${combinedOdds.toFixed(2)}x combined odds`
                    : `Custom bet: ${betName} at ${odds}x odds`,
                parlay_combined_odds: isParlay ? combinedOdds : null,
                parlay_combined_probability: isParlay ? impliedProb : null,
                parlay_potential_payout: isParlay ? stake * combinedOdds : null,
                parlay_recommended_stake: isParlay ? stake : null,
                screenshots: screenshots || null,
            })
            .select()
            .single();

        if (predictionError) {
            console.error('Error saving custom bet:', predictionError);
            return NextResponse.json({ error: 'Failed to save bet' }, { status: 500 });
        }

        // Insert bet options
        if (isParlay && legs) {
            // Insert each parlay leg as a separate option
            const optionsToInsert = legs.map((leg) => ({
                prediction_id: predictionData.id,
                name: leg.name,
                implied_probability: leg.odds >= 1 ? (1 / leg.odds) * 100 : 0,
                ai_probability: null,
                edge: null,
                recommended_stake: null,
            }));

            const { error: optionsError } = await supabase
                .from('prediction_options')
                .insert(optionsToInsert);

            if (optionsError) {
                console.error('Error saving parlay legs:', optionsError);
                // Don't fail the request if options fail
            }
        } else {
            // Insert single bet option
            const { error: optionError } = await supabase
                .from('prediction_options')
                .insert({
                    prediction_id: predictionData.id,
                    name: betName,
                    implied_probability: impliedProb,
                    ai_probability: null,
                    edge: null,
                    recommended_stake: stake,
                });

            if (optionError) {
                console.error('Error saving option:', optionError);
                // Don't fail the request if option fails
            }
        }

        return NextResponse.json({
            success: true,
            predictionId: predictionData.id,
        });

    } catch (error) {
        console.error('Custom bet error:', error);
        return NextResponse.json({ error: 'Failed to save custom bet' }, { status: 500 });
    }
}
