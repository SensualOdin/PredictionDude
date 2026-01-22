-- Migration: Add screenshots column to predictions table
-- This allows storing multiple bet ticket screenshots for custom bets

-- Add screenshots column as a JSON array to store base64 image strings
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN predictions.screenshots IS 'Array of base64-encoded image strings for bet ticket screenshots';

-- Create an index on screenshots for faster queries (using GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_predictions_screenshots
ON predictions USING GIN (screenshots)
WHERE screenshots IS NOT NULL;

-- Example usage after migration:
-- UPDATE predictions SET screenshots = '["data:image/png;base64,iVBORw0KG...", "data:image/jpeg;base64,/9j/4AAQ..."]'::jsonb WHERE id = 'some-uuid';
