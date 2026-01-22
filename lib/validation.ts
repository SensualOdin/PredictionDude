import { z } from 'zod';

// Constants for validation
export const VALIDATION_LIMITS = {
    MIN_BANKROLL: 1,
    MAX_BANKROLL: 1_000_000,
    MAX_QUESTION_LENGTH: 1000,
    MAX_IMAGE_COUNT: 5,
    MAX_IMAGE_SIZE_MB: 10,
    MIN_ODDS: 1.01,
    MAX_ODDS: 1000,
    MAX_PARLAY_LEGS: 20,
    MIN_PARLAY_LEGS: 2,
} as const;

// Helper to validate base64 image string
const base64ImageSchema = z.string()
    .refine((str) => {
        // Check if it starts with data:image
        if (!str.startsWith('data:image/')) return false;

        // Extract the base64 part
        const base64Match = str.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) return false;

        const base64Data = base64Match[1];

        // Rough size check (base64 is ~1.37x larger than binary)
        const estimatedSizeMB = (base64Data.length * 0.75) / (1024 * 1024);
        return estimatedSizeMB <= VALIDATION_LIMITS.MAX_IMAGE_SIZE_MB;
    }, {
        message: `Each image must be under ${VALIDATION_LIMITS.MAX_IMAGE_SIZE_MB}MB`,
    });

// Prediction request validation
export const predictionRequestSchema = z.object({
    question: z.string()
        .min(1, 'Question is required')
        .max(VALIDATION_LIMITS.MAX_QUESTION_LENGTH, `Question must be under ${VALIDATION_LIMITS.MAX_QUESTION_LENGTH} characters`),

    bankroll: z.number()
        .min(VALIDATION_LIMITS.MIN_BANKROLL, `Bankroll must be at least $${VALIDATION_LIMITS.MIN_BANKROLL}`)
        .max(VALIDATION_LIMITS.MAX_BANKROLL, `Bankroll must be under $${VALIDATION_LIMITS.MAX_BANKROLL.toLocaleString()}`),

    isParlay: z.boolean().default(false),

    inputMode: z.enum(['images', 'manual']),

    images: z.array(base64ImageSchema)
        .max(VALIDATION_LIMITS.MAX_IMAGE_COUNT, `Maximum ${VALIDATION_LIMITS.MAX_IMAGE_COUNT} images allowed`)
        .optional(),

    manualInput: z.string()
        .max(VALIDATION_LIMITS.MAX_QUESTION_LENGTH)
        .optional(),
}).refine((data) => {
    // If inputMode is 'images', images array must be provided and not empty
    if (data.inputMode === 'images' && (!data.images || data.images.length === 0)) {
        return false;
    }
    return true;
}, {
    message: 'Images are required when input mode is "images"',
});

// Extract bet info validation (screenshot OCR)
export const extractBetSchema = z.object({
    images: z.array(base64ImageSchema)
        .min(1, 'At least one image is required')
        .max(VALIDATION_LIMITS.MAX_IMAGE_COUNT, `Maximum ${VALIDATION_LIMITS.MAX_IMAGE_COUNT} images allowed`),
});

// Custom bet validation
export const customBetSchema = z.object({
    betName: z.string()
        .min(1, 'Bet name is required')
        .max(500, 'Bet name is too long'),

    odds: z.number()
        .min(VALIDATION_LIMITS.MIN_ODDS, `Odds must be at least ${VALIDATION_LIMITS.MIN_ODDS}`)
        .max(VALIDATION_LIMITS.MAX_ODDS, `Odds must be under ${VALIDATION_LIMITS.MAX_ODDS}`),

    stake: z.number()
        .min(VALIDATION_LIMITS.MIN_BANKROLL, `Stake must be at least $${VALIDATION_LIMITS.MIN_BANKROLL}`)
        .max(VALIDATION_LIMITS.MAX_BANKROLL, `Stake must be under $${VALIDATION_LIMITS.MAX_BANKROLL.toLocaleString()}`),

    notes: z.string()
        .max(1000, 'Notes are too long')
        .optional(),

    isParlay: z.boolean(),

    legs: z.array(z.object({
        name: z.string().min(1, 'Leg name is required'),
        odds: z.number()
            .min(VALIDATION_LIMITS.MIN_ODDS, `Odds must be at least ${VALIDATION_LIMITS.MIN_ODDS}`)
            .max(VALIDATION_LIMITS.MAX_ODDS, `Odds must be under ${VALIDATION_LIMITS.MAX_ODDS}`),
    }))
        .min(VALIDATION_LIMITS.MIN_PARLAY_LEGS)
        .max(VALIDATION_LIMITS.MAX_PARLAY_LEGS)
        .optional(),

    screenshots: z.array(base64ImageSchema)
        .max(VALIDATION_LIMITS.MAX_IMAGE_COUNT)
        .optional(),
}).refine((data) => {
    // If isParlay is true, legs must be provided with at least 2 legs
    if (data.isParlay && (!data.legs || data.legs.length < VALIDATION_LIMITS.MIN_PARLAY_LEGS)) {
        return false;
    }
    return true;
}, {
    message: `Parlay requires at least ${VALIDATION_LIMITS.MIN_PARLAY_LEGS} legs`,
});

// Save bet validation
export const saveBetSchema = z.object({
    predictionId: z.string()
        .uuid('Invalid prediction ID'),

    selectedOption: z.string()
        .min(1, 'Selected option is required'),

    stake: z.number()
        .min(VALIDATION_LIMITS.MIN_BANKROLL, `Stake must be at least $${VALIDATION_LIMITS.MIN_BANKROLL}`)
        .max(VALIDATION_LIMITS.MAX_BANKROLL, `Stake must be under $${VALIDATION_LIMITS.MAX_BANKROLL.toLocaleString()}`),
});

// Update outcome validation
export const updateOutcomeSchema = z.object({
    predictionId: z.string()
        .uuid('Invalid prediction ID'),

    optionId: z.string()
        .uuid('Invalid option ID'),

    outcome: z.enum(['won', 'lost', 'voided', 'pending']),
});

// Helper function to validate and return errors in a consistent format
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Format Zod errors into a readable string
    const errorMessage = result.error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');

    return { success: false, error: errorMessage };
}
