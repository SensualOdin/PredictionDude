import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';

// Validation schema for applying prompt updates
const applyPromptSchema = z.object({
    learningIterationId: z.string().uuid(),
    promptSections: z.object({
        COGNITIVE_POSTURE: z.string().nullable(),
        DOMAIN_ADJUSTMENTS: z.string().nullable(),
        STAKE_DISTRIBUTION: z.string().nullable(),
        DEBIASING_CHECKLIST: z.string().nullable(),
    }),
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

        // Validate request body
        const body = await request.json();
        const validation = validateRequest(applyPromptSchema, body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { learningIterationId, promptSections } = validation.data;

        // Verify the learning iteration belongs to this user
        const { data: iteration, error: iterError } = await supabase
            .from('learning_iterations')
            .select('id')
            .eq('id', learningIterationId)
            .eq('user_id', user.id)
            .single();

        if (iterError || !iteration) {
            return NextResponse.json(
                { error: 'Learning iteration not found' },
                { status: 404 }
            );
        }

        // Get the current highest version number for this user
        const { data: latestVersion } = await supabase
            .from('prompt_versions')
            .select('version_number')
            .eq('user_id', user.id)
            .order('version_number', { ascending: false })
            .limit(1)
            .single();

        const newVersionNumber = (latestVersion?.version_number || 0) + 1;

        // Deactivate all existing active prompts for this user
        await supabase
            .from('prompt_versions')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('is_active', true);

        // Create the new active prompt version
        const { data: newVersion, error: insertError } = await supabase
            .from('prompt_versions')
            .insert({
                user_id: user.id,
                version_number: newVersionNumber,
                prompt_sections: promptSections,
                learning_iteration_id: learningIterationId,
                is_active: true,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error creating prompt version:', insertError);
            return NextResponse.json(
                { error: 'Failed to apply prompt updates. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            version: {
                id: newVersion.id,
                versionNumber: newVersion.version_number,
                createdAt: newVersion.created_at,
            },
        });

    } catch (error) {
        console.error('Apply prompt error:', error);
        return NextResponse.json(
            { error: 'Failed to apply prompt updates. Please try again.' },
            { status: 500 }
        );
    }
}
