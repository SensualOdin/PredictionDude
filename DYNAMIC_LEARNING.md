# Dynamic AI Learning System

This document explains how the dynamic learning system works and how it improves AI predictions over time.

## Overview

The dynamic learning system allows the AI to **automatically improve its prediction accuracy** based on your historical bet results. Instead of manually editing code, you can now:

1. Let the AI analyze your settled bets
2. Review the suggested improvements
3. Click a button to apply updates
4. All future predictions use the improved system prompt

## How It Works

### The Learning Flow

```
1. User marks bets as won/lost in History page
   ↓
2. User clicks "Run Learning Analysis" on Learn page
   ↓
3. AI analyzes last 50 settled predictions
   ↓
4. AI identifies patterns, biases, and areas for improvement
   ↓
5. AI generates updated prompt sections
   ↓
6. User reviews proposed changes
   ↓
7. User clicks "Apply Updates"
   ↓
8. New prompt version is saved and activated
   ↓
9. All future predictions use the improved prompt
```

## Database Architecture

### New Table: `prompt_versions`

Stores versioned system prompts that evolve through learning.

```sql
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    version_number INT NOT NULL,           -- Incremental version (1, 2, 3...)
    prompt_sections JSONB NOT NULL,        -- Custom prompt overrides
    learning_iteration_id UUID,            -- Links to the learning run
    is_active BOOLEAN DEFAULT false,       -- Only one active per user
    created_at TIMESTAMP
);
```

**Example `prompt_sections` JSON:**
```json
{
  "COGNITIVE_POSTURE": "Be a fox, not a hedgehog... [custom improvements]",
  "DOMAIN_ADJUSTMENTS": null,
  "STAKE_DISTRIBUTION": "Use Kelly Criterion with 25% fractional sizing...",
  "DEBIASING_CHECKLIST": null
}
```

Only non-null sections override the base prompt. Null sections use the default.

## File Structure

### Core Files

**API Routes:**
- `/app/api/learn/route.ts` - Analyzes predictions and generates improvements
- `/app/api/prompt/apply/route.ts` - Applies prompt updates and creates new version
- `/app/api/predict/route.ts` - Updated to load user's custom prompt

**Utilities:**
- `/lib/promptLoader.ts` - Loads active prompt version for a user
- `/lib/systemPrompt.ts` - Base system prompt (unchanged)

**UI:**
- `/app/learn/page.tsx` - Learning dashboard with Apply Updates button

**Database:**
- `/supabase/migrations/create_prompt_versions.sql` - Table creation

## Prompt Override System

### How Overrides Work

The system uses a **section-based override** approach:

1. **Base Prompt** (from `lib/systemPrompt.ts`) is always the foundation
2. **Custom Sections** from database override specific parts
3. **Merge Logic** replaces only the specified sections

**Example:**

**Base Prompt:**
```
## COGNITIVE POSTURE
Be a fox, not a hedgehog.
Think probabilistically.

## DOMAIN-SPECIFIC ADJUSTMENTS
Sports: Consider team dynamics.
```

**Custom Override (from database):**
```json
{
  "COGNITIVE_POSTURE": "Be a fox, not a hedgehog. Think probabilistically. Be more conservative in low-information scenarios where base rate data is sparse.",
  "DOMAIN_ADJUSTMENTS": null
}
```

**Resulting Prompt Sent to AI:**
```
## COGNITIVE POSTURE
Be a fox, not a hedgehog. Think probabilistically. Be more conservative in low-information scenarios where base rate data is sparse.

## DOMAIN-SPECIFIC ADJUSTMENTS
Sports: Consider team dynamics.
```

Only `COGNITIVE_POSTURE` was updated; `DOMAIN_ADJUSTMENTS` remains default.

## User Experience

### Learning Dashboard (`/learn`)

**Step 1: Run Analysis**
- Click "Run Learning Analysis" button
- AI analyzes your last 50 settled bets
- Displays calibration, strengths, weaknesses, patterns

**Step 2: Review Recommendations**
- See specific areas for improvement
- View the exact prompt changes proposed
- Read the rationale for each change

**Step 3: Apply Updates**
- Click "Apply Updates to System Prompt"
- System creates a new prompt version
- Confirmation message shows version number

**Step 4: Automatic Usage**
- All future predictions automatically use the improved prompt
- No code changes needed
- No manual configuration required

### Visual Feedback

**Analysis Results Show:**
- ✅ Analysis Complete
- 📊 Calibration metrics
- 💪 Strengths identified
- ⚠️ Areas to improve
- 📝 Specific recommendations

**Prompt Updates Preview:**
- 🔄 Proposed changes highlighted
- Green boxes show new content
- Section names clearly labeled
- Preview of updated text

**Apply Button:**
- Blue-to-green gradient
- Loading state during application
- Success message with version number

## Technical Implementation

### Prompt Loading Logic

**File: `/lib/promptLoader.ts`**

```typescript
export async function getSystemPrompt(userId: string): Promise<string> {
    // 1. Fetch active prompt version for user
    const { data: activePrompt } = await supabase
        .from('prompt_versions')
        .select('prompt_sections')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    // 2. If no custom prompt, use default
    if (!activePrompt) {
        return SYSTEM_PROMPT;
    }

    // 3. Apply custom overrides to base prompt
    return applyPromptOverrides(SYSTEM_PROMPT, activePrompt.prompt_sections);
}
```

### Version Management

**Only one active version per user:**
```typescript
// When applying updates, deactivate all existing versions
await supabase
    .from('prompt_versions')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true);

// Then activate the new version
await supabase
    .from('prompt_versions')
    .insert({
        user_id: user.id,
        version_number: newVersionNumber,
        is_active: true,
        ...
    });
```

## API Endpoints

### POST `/api/learn`

**Purpose:** Analyze predictions and generate improvements

**Request:**
```json
// No body required
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 50,
    "won": 32,
    "winRate": "64.0"
  },
  "analysis": {
    "calibration": "Predictions are well-calibrated overall...",
    "strengths": ["Strong performance on sports bets", "..."],
    "weaknesses": ["Overconfident on politics", "..."],
    "patterns": ["Wins more on favorites", "..."]
  },
  "recommendations": [
    {
      "section": "COGNITIVE_POSTURE",
      "change": "Be more conservative in low-information scenarios",
      "rationale": "Analysis shows overconfidence when data is sparse"
    }
  ],
  "updatedPromptSections": {
    "COGNITIVE_POSTURE": "Updated text...",
    "DOMAIN_ADJUSTMENTS": null,
    "STAKE_DISTRIBUTION": null,
    "DEBIASING_CHECKLIST": null
  },
  "summary": "Key learnings summary...",
  "iterationId": "uuid-here"
}
```

### POST `/api/prompt/apply`

**Purpose:** Apply prompt updates and create new version

**Request:**
```json
{
  "learningIterationId": "uuid-of-learning-run",
  "promptSections": {
    "COGNITIVE_POSTURE": "Updated text...",
    "DOMAIN_ADJUSTMENTS": null,
    "STAKE_DISTRIBUTION": null,
    "DEBIASING_CHECKLIST": null
  }
}
```

**Response:**
```json
{
  "success": true,
  "version": {
    "id": "uuid-of-new-version",
    "versionNumber": 3,
    "createdAt": "2026-01-22T10:30:00Z"
  }
}
```

## Security & Validation

**Row-Level Security (RLS):**
- Users can only view/modify their own prompt versions
- Enforced at database level via Supabase policies

**Validation:**
- Learning iteration ID must belong to requesting user
- Prompt sections validated with Zod schema
- Only valid JSON objects accepted

**Fallback Safety:**
- If database query fails, uses default prompt
- No prediction requests fail due to prompt loading errors
- Build process works without environment variables

## Migration Instructions

### Database Migration

Run the SQL migration to create the new table:

```bash
# Apply migration to Supabase
# File: supabase/migrations/create_prompt_versions.sql
```

**What it does:**
- Creates `prompt_versions` table
- Adds indexes for performance
- Sets up RLS policies
- Links to `learning_iterations` table

### No Code Changes Needed

The system is **backward compatible**:
- Existing users continue using default prompt
- Predictions work exactly as before
- Learning system is opt-in

### Testing Checklist

- [ ] Run `npm run build` successfully
- [ ] Navigate to `/learn` page
- [ ] Mark at least 3 bets as won/lost in `/history`
- [ ] Click "Run Learning Analysis"
- [ ] Verify analysis results display
- [ ] Verify "Proposed Prompt Updates" section shows
- [ ] Click "Apply Updates to System Prompt"
- [ ] Verify success message appears
- [ ] Make a new prediction
- [ ] Check logs to confirm custom prompt loaded

## Monitoring & Debugging

### Check Active Prompt Version

```sql
SELECT
    version_number,
    prompt_sections,
    is_active,
    created_at
FROM prompt_versions
WHERE user_id = 'your-user-id'
ORDER BY version_number DESC;
```

### View Learning History

```sql
SELECT
    li.created_at,
    li.predictions_analyzed,
    li.win_rate,
    pv.version_number,
    pv.is_active
FROM learning_iterations li
LEFT JOIN prompt_versions pv ON pv.learning_iteration_id = li.id
WHERE li.user_id = 'your-user-id'
ORDER BY li.created_at DESC;
```

### Rollback to Previous Version

```sql
-- Deactivate current version
UPDATE prompt_versions
SET is_active = false
WHERE user_id = 'your-user-id' AND is_active = true;

-- Activate previous version
UPDATE prompt_versions
SET is_active = true
WHERE user_id = 'your-user-id' AND version_number = 2;
```

## Performance Considerations

**Caching:**
- Consider caching active prompt in memory
- Current implementation queries database on each prediction
- For high-traffic apps, add Redis cache layer

**Query Optimization:**
- Index on `(user_id, is_active)` makes lookups fast
- Only one active version per user (efficient)
- Learning analysis limited to last 50 predictions

**Build Time:**
- Fallback clients prevent build failures
- No environment variables required at build time
- Static pages generate successfully

## Future Enhancements

**Potential Improvements:**

1. **A/B Testing**
   - Compare performance between prompt versions
   - Automatically promote better-performing versions

2. **Prompt Diff Viewer**
   - Show side-by-side before/after comparison
   - Highlight exact changes in each section

3. **Rollback UI**
   - Allow users to revert to previous versions
   - View full version history with metrics

4. **Automatic Application**
   - Option to auto-apply improvements above confidence threshold
   - Email notifications when learning runs complete

5. **Multi-Model Support**
   - Test prompt versions across different AI models
   - Compare Gemini vs GPT-4 vs Claude performance

## Troubleshooting

**Issue:** "Need at least 3 settled predictions"
- **Solution:** Mark more bets as won/lost in History page

**Issue:** Learning analysis fails
- **Solution:** Check Gemini API key is configured
- **Solution:** Verify at least 3 predictions have outcomes

**Issue:** Prompt updates don't apply
- **Solution:** Check database connection
- **Solution:** Verify learning iteration belongs to user

**Issue:** Predictions still use old prompt
- **Solution:** Clear browser cache
- **Solution:** Check only one version is active
- **Solution:** Verify `getSystemPrompt` is called in predict API

## Summary

The dynamic learning system provides:

- ✅ **Automatic Improvement** - AI learns from your results
- ✅ **User Control** - Review before applying changes
- ✅ **Version History** - Track improvements over time
- ✅ **Zero Downtime** - Seamless prompt updates
- ✅ **Per-User Customization** - Each user's AI evolves independently
- ✅ **Fallback Safety** - Always works, even without custom prompts

This creates a **collaborative human-AI feedback loop** where the system continuously improves based on real-world performance.

---

**Implemented:** January 2026
**Next Phase:** A/B testing, automatic rollbacks, prompt diffing UI
