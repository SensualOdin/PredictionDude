import { createClient } from '@/lib/supabase/server';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';

/**
 * Loads the active system prompt for a user, with custom overrides if available
 * Falls back to default SYSTEM_PROMPT if no custom version exists
 */
export async function getSystemPrompt(userId: string): Promise<string> {
    try {
        const supabase = await createClient();

        // Fetch the active prompt version for this user
        const { data: activePrompt, error } = await supabase
            .from('prompt_versions')
            .select('prompt_sections')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        // If no custom prompt or error, return default
        if (error || !activePrompt) {
            return SYSTEM_PROMPT;
        }

        // Apply custom sections to the base prompt
        return applyPromptOverrides(SYSTEM_PROMPT, activePrompt.prompt_sections);

    } catch (error) {
        console.error('Error loading system prompt:', error);
        return SYSTEM_PROMPT;
    }
}

/**
 * Applies custom prompt section overrides to the base system prompt
 */
function applyPromptOverrides(basePrompt: string, sections: Record<string, string | null>): string {
    let customPrompt = basePrompt;

    // Define section markers that exist in the base prompt
    const sectionMarkers = {
        COGNITIVE_POSTURE: '## COGNITIVE POSTURE',
        DOMAIN_ADJUSTMENTS: '## DOMAIN-SPECIFIC ADJUSTMENTS',
        STAKE_DISTRIBUTION: '## STAKE DISTRIBUTION ALGORITHM',
        DEBIASING_CHECKLIST: '## DEBIASING CHECKLIST',
    };

    // Apply each override if it exists
    for (const [key, marker] of Object.entries(sectionMarkers)) {
        const override = sections[key as keyof typeof sections];

        if (override) {
            // Find the section in the base prompt
            const markerIndex = customPrompt.indexOf(marker);

            if (markerIndex !== -1) {
                // Find the next section marker or end of prompt
                const nextMarkerIndex = findNextSectionMarker(customPrompt, markerIndex + marker.length);

                // Replace the section content (keep the marker, replace what follows until next section)
                const before = customPrompt.substring(0, markerIndex + marker.length);
                const after = nextMarkerIndex !== -1 ? customPrompt.substring(nextMarkerIndex) : '';

                customPrompt = before + '\n' + override + '\n\n' + after;
            }
        }
    }

    return customPrompt;
}

/**
 * Finds the index of the next section marker starting from a given position
 */
function findNextSectionMarker(text: string, startIndex: number): number {
    const markers = [
        '## COGNITIVE POSTURE',
        '## DOMAIN-SPECIFIC ADJUSTMENTS',
        '## STAKE DISTRIBUTION ALGORITHM',
        '## DEBIASING CHECKLIST',
        '## OUTPUT FORMAT',
        '## RULES',
    ];

    let nearestIndex = -1;

    for (const marker of markers) {
        const index = text.indexOf(marker, startIndex);
        if (index !== -1 && (nearestIndex === -1 || index < nearestIndex)) {
            nearestIndex = index;
        }
    }

    return nearestIndex;
}
