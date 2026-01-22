/**
 * Simple in-memory rate limiter
 * For production, consider using Upstash Redis or Vercel's edge config
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    /**
     * Maximum number of requests allowed in the window
     */
    maxRequests: number;

    /**
     * Window duration in seconds
     */
    windowSeconds: number;
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier (e.g., user ID, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    const entry = rateLimitStore.get(identifier);

    // No entry exists or window has expired
    if (!entry || entry.resetAt < now) {
        const resetAt = now + windowMs;
        rateLimitStore.set(identifier, {
            count: 1,
            resetAt,
        });

        return {
            success: true,
            limit: config.maxRequests,
            remaining: config.maxRequests - 1,
            reset: resetAt,
        };
    }

    // Entry exists and window is still valid
    if (entry.count < config.maxRequests) {
        entry.count++;
        return {
            success: true,
            limit: config.maxRequests,
            remaining: config.maxRequests - entry.count,
            reset: entry.resetAt,
        };
    }

    // Rate limit exceeded
    return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: entry.resetAt,
    };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
    // AI prediction endpoint (expensive)
    PREDICT: {
        maxRequests: 10,
        windowSeconds: 60, // 10 requests per minute
    },

    // Screenshot extraction (expensive)
    EXTRACT: {
        maxRequests: 5,
        windowSeconds: 60, // 5 requests per minute
    },

    // Saving bets (moderate)
    SAVE: {
        maxRequests: 20,
        windowSeconds: 60, // 20 requests per minute
    },

    // Custom bets (moderate)
    CUSTOM: {
        maxRequests: 15,
        windowSeconds: 60, // 15 requests per minute
    },

    // General API calls
    DEFAULT: {
        maxRequests: 30,
        windowSeconds: 60, // 30 requests per minute
    },
} as const;
