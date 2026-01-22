-- Create prompt_versions table for dynamic AI learning
CREATE TABLE IF NOT EXISTS prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    prompt_sections JSONB NOT NULL,
    learning_iteration_id UUID REFERENCES learning_iterations(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, version_number)
);

-- Create index for quick active prompt lookup
CREATE INDEX IF NOT EXISTS idx_prompt_versions_active
ON prompt_versions(user_id, is_active)
WHERE is_active = true;

-- Create index for version history
CREATE INDEX IF NOT EXISTS idx_prompt_versions_user_version
ON prompt_versions(user_id, version_number DESC);

-- Enable RLS
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own prompt versions"
    ON prompt_versions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own prompt versions"
    ON prompt_versions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompt versions"
    ON prompt_versions FOR UPDATE
    USING (auth.uid() = user_id);

-- Comment on table
COMMENT ON TABLE prompt_versions IS 'Stores versioned system prompts that evolve through AI learning iterations';
COMMENT ON COLUMN prompt_versions.prompt_sections IS 'JSONB object containing prompt section overrides: {COGNITIVE_POSTURE: "...", DOMAIN_ADJUSTMENTS: "...", etc.}';
COMMENT ON COLUMN prompt_versions.is_active IS 'Only one version per user should be active at a time';
