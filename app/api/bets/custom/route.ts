import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ParlayLeg {
    name: string;
    odds: number;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { betName, odds, stake, isParlay, notes, legs } = body;

        if (!stake) {
            return NextResponse.json({ error: 'Stake is required' }, { status: 400 });
        }

        if (isParlay && (!legs || legs.length < 2)) {
            return NextResponse.json({ error: 'Parlay requires at least 2 legs' }, { status: 400 });
        }

        if (!isParlay && (!betName || !odds)) {
            return NextResponse.json({ error: 'Bet name and odds are required' }, { status: 400 });
        }

        // Calculate combined odds for parlay
        const combinedOdds = isParlay
            ? legs.reduce((acc: number, leg: ParlayLeg) => acc * leg.odds, 1)
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
                reasoning: isParlay
                    ? `Custom parlay: ${legs.map((l: ParlayLeg) => l.name).join(' + ')} at ${combinedOdds.toFixed(2)}x combined odds`
                    : `Custom bet: ${betName} at ${odds}x odds`,
                parlay_combined_odds: isParlay ? combinedOdds : null,
                parlay_combined_probability: isParlay ? impliedProb : null,
                parlay_potential_payout: isParlay ? stake * combinedOdds : null,
                parlay_recommended_stake: isParlay ? stake : null,
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
            const optionsToInsert = legs.map((leg: ParlayLeg) => ({
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
