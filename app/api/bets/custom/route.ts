import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { betName, odds, stake, bankroll, isParlay, notes } = body;

        if (!betName || !odds || !stake) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Calculate implied probability from odds
        let impliedProb = 0;
        if (odds >= 1) {
            // Decimal odds (e.g., 1.5, 2.0)
            impliedProb = (1 / odds) * 100;
        }

        // Insert custom prediction
        const { data: predictionData, error: predictionError } = await supabase
            .from('predictions')
            .insert({
                user_id: user.id,
                question: notes || 'Custom bet',
                bankroll: bankroll || stake,
                is_parlay: isParlay || false,
                input_mode: 'manual',
                predicted_winner: betName,
                confidence: null,
                reasoning: `Custom bet: ${betName} at ${odds}x odds`,
            })
            .select()
            .single();

        if (predictionError) {
            console.error('Error saving custom bet:', predictionError);
            return NextResponse.json({ error: 'Failed to save bet' }, { status: 500 });
        }

        // Insert the bet option
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

        return NextResponse.json({
            success: true,
            predictionId: predictionData.id,
        });

    } catch (error) {
        console.error('Custom bet error:', error);
        return NextResponse.json({ error: 'Failed to save custom bet' }, { status: 500 });
    }
}
